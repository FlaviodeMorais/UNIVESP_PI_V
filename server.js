import express from 'express';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cors from 'cors';
import fetch from 'node-fetch';
import cron from 'node-cron';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static('public'));
app.use('/node_modules', express.static('node_modules'));
app.use(cors());

// SQLite database connection
let db;

// Initialize database
async function initializeDatabase() {
    try {
        db = await open({
            filename: 'aquaponia.db',
            driver: sqlite3.Database
        });

        // Create tables if they don't exist
        await db.exec(`
            -- Tabela principal de leituras
            CREATE TABLE IF NOT EXISTS readings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                temperature REAL,
                level REAL,
                pump_status INTEGER DEFAULT 0,
                heater_status INTEGER DEFAULT 0,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                temperature_trend REAL DEFAULT 0,
                level_trend REAL DEFAULT 0,
                is_temp_critical BOOLEAN DEFAULT 0,
                is_level_critical BOOLEAN DEFAULT 0,
                data_source VARCHAR(50) DEFAULT 'thingspeak',
                data_quality REAL DEFAULT 1.0
            );

            -- Índices para otimização
            CREATE INDEX IF NOT EXISTS idx_readings_timestamp ON readings(timestamp);
            CREATE INDEX IF NOT EXISTS idx_readings_temperature ON readings(temperature);
            CREATE INDEX IF NOT EXISTS idx_readings_level ON readings(level);

            -- Tabela de estatísticas diárias
            CREATE TABLE IF NOT EXISTS daily_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date DATE UNIQUE,
                min_temperature REAL,
                max_temperature REAL,
                avg_temperature REAL,
                min_level REAL,
                max_level REAL,
                avg_level REAL,
                pump_active_time INTEGER,
                heater_active_time INTEGER,
                reading_count INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Tabela de alertas
            CREATE TABLE IF NOT EXISTS alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type VARCHAR(50),
                severity VARCHAR(20),
                message TEXT,
                reading_id INTEGER,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                resolved_at DATETIME,
                FOREIGN KEY (reading_id) REFERENCES readings(id)
            );

            -- Tabela de configurações do sistema
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Configurações padrão
            INSERT OR IGNORE INTO settings (key, value) VALUES
                ('systemName', 'Aquaponia'),
                ('updateInterval', '1'),
                ('dataRetention', '30'),
                ('emailAlerts', 'true'),
                ('pushAlerts', 'true'),
                ('alertEmail', ''),
                ('tempCriticalMin', '18'),
                ('tempWarningMin', '20'),
                ('tempWarningMax', '28'),
                ('tempCriticalMax', '30'),
                ('levelCriticalMin', '50'),
                ('levelWarningMin', '60'),
                ('levelWarningMax', '85'),
                ('levelCriticalMax', '90'),
                ('pumpAuto', 'true'),
                ('pumpOnTime', '06:00'),
                ('pumpOffTime', '18:00'),
                ('heaterAuto', 'true'),
                ('heaterOnTemp', '22'),
                ('heaterOffTemp', '24');
        `);

        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Error initializing database:', error);
    }
}

// ThingSpeak configuration
const THINGSPEAK_READ_API_KEY = process.env.THINGSPEAK_READ_API_KEY;
const THINGSPEAK_WRITE_API_KEY = process.env.THINGSPEAK_WRITE_API_KEY;
const THINGSPEAK_CHANNEL_ID = process.env.THINGSPEAK_CHANNEL_ID;
const THINGSPEAK_BASE_URL = 'https://api.thingspeak.com';

// Write data to ThingSpeak
async function writeToThingSpeak(data) {
    try {
        // Ensure all values are valid numbers before sending
        const temperature = parseFloat(data.temperature) || 0;
        const level = parseFloat(data.level) || 0;
        const pump_status = parseInt(data.pump_status) || 0;
        const heater_status = parseInt(data.heater_status) || 0;

        // Build the URL with properly formatted numbers
        const url = new URL(`${THINGSPEAK_BASE_URL}/update`);
        url.searchParams.append('api_key', THINGSPEAK_WRITE_API_KEY);
        url.searchParams.append('field1', temperature.toFixed(2));
        url.searchParams.append('field2', level.toFixed(2));
        url.searchParams.append('field3', pump_status.toString());
        url.searchParams.append('field4', heater_status.toString());

        console.log('Writing to ThingSpeak:', url.toString());

        const response = await fetch(url.toString());
        
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Failed to write to ThingSpeak: ${response.status} ${response.statusText} - ${text}`);
        }

        const result = await response.text();
        console.log('ThingSpeak write response:', result);
        return parseInt(result) || null;
    } catch (error) {
        console.error('Error writing to ThingSpeak:', error);
        throw error;
    }
}

// Fetch data from ThingSpeak
async function fetchThingSpeakData() {
    try {
        console.log('Fetching data from ThingSpeak...');
        const response = await fetch(
            `${THINGSPEAK_BASE_URL}/channels/${THINGSPEAK_CHANNEL_ID}/feeds.json?api_key=${THINGSPEAK_READ_API_KEY}&results=1`
        );
        
        if (!response.ok) {
            throw new Error(`Failed to fetch data from ThingSpeak: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('ThingSpeak response:', data);

        if (data.feeds && data.feeds.length > 0) {
            const latestFeed = data.feeds[0];
            // Ensure we have valid numbers for both temperature and level
            const temperature = parseFloat(latestFeed.field1) || null;
            const level = parseFloat(latestFeed.field2) || null;
            
            const reading = {
                temperature,
                level,
                timestamp: new Date(latestFeed.created_at)
            };
            
            console.log('Parsed reading:', reading);
            return reading;
        }
        console.log('No data available from ThingSpeak');
        return null;
    } catch (error) {
        console.error('Error fetching ThingSpeak data:', error);
        return null;
    }
}

// Save reading to database and ThingSpeak
async function saveReading(reading) {
    try {
        console.log('Saving reading to database:', reading);
        const result = await db.run(
            `INSERT INTO readings (temperature, level, timestamp)
             VALUES (?, ?, ?)`,
            [reading.temperature, reading.level, reading.timestamp]
        );

        // Write to ThingSpeak
        await writeToThingSpeak(reading);

        console.log('Reading saved successfully. Row ID:', result.lastID);
        return result;
    } catch (error) {
        console.error('Error saving reading:', error);
        return null;
    }
}

// Schedule data collection
cron.schedule('*/1 * * * *', async () => {
    console.log('Starting scheduled data collection...');
    const reading = await fetchThingSpeakData();
    if (reading) {
        await saveReading(reading);
        console.log('Data collection cycle completed successfully');
    } else {
        console.log('No data collected in this cycle');
    }
});

// API Routes
app.get('/api/temperature/latest', async (req, res) => {
    try {
        const readings = await db.all(
            `SELECT * FROM readings 
             ORDER BY timestamp DESC 
             LIMIT 10`
        );
        console.log(`Returning ${readings.length} latest readings`);
        res.json(readings.reverse());
    } catch (error) {
        console.error('Error fetching latest readings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/temperature', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        console.log(`Fetching readings from ${startDate} to ${endDate}`);
        const readings = await db.all(
            `SELECT * FROM readings 
             WHERE timestamp BETWEEN ? AND ?
             ORDER BY timestamp ASC`,
            [startDate, endDate]
        );
        console.log(`Found ${readings.length} readings in date range`);
        res.json(readings);
    } catch (error) {
        console.error('Error fetching readings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/control/:device', async (req, res) => {
    const { device } = req.params;
    const { state } = req.body;
    
    try {
        const statusField = device === 'bomba' ? 'pump_status' : 'heater_status';
        const newState = state ? 1 : 0;

        // Update the database
        await db.run(
            `UPDATE readings 
             SET ${statusField} = ?
             WHERE id = (SELECT id FROM readings ORDER BY timestamp DESC LIMIT 1)`,
            [newState]
        );

        // Get the latest reading to send to ThingSpeak
        const latestReading = await db.get(
            'SELECT * FROM readings ORDER BY timestamp DESC LIMIT 1'
        );

        // Write the updated state to ThingSpeak
        await writeToThingSpeak(latestReading);

        console.log(`Updated ${device} state to ${state}`);
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating device state:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/settings', async (req, res) => {
    try {
        const settings = await db.all('SELECT key, value FROM settings');
        const settingsObject = settings.reduce((obj, item) => {
            // Try to parse numbers and booleans
            let value = item.value;
            if (value === 'true') value = true;
            else if (value === 'false') value = false;
            else if (!isNaN(value)) value = parseFloat(value);
            
            obj[item.key] = value;
            return obj;
        }, {});
        res.json(settingsObject);
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/settings', async (req, res) => {
    try {
        const settings = req.body;
        console.log('Updating settings:', settings);

        // Begin transaction
        await db.run('BEGIN TRANSACTION');

        for (const [key, value] of Object.entries(settings)) {
            // Convert all values to strings for storage
            const stringValue = value?.toString() || '';
            
            await db.run(
                `INSERT OR REPLACE INTO settings (key, value, updated_at) 
                 VALUES (?, ?, CURRENT_TIMESTAMP)`,
                [key, stringValue]
            );
        }

        // Commit transaction
        await db.run('COMMIT');
        
        console.log('Settings updated successfully');
        res.json({ success: true });
    } catch (error) {
        // Rollback on error
        await db.run('ROLLBACK');
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Initialize database and start server
const PORT = process.env.PORT || 3000;

async function startServer() {
    await initializeDatabase();
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

startServer();