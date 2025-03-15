document.addEventListener('DOMContentLoaded', () => {
    let temperatureChart = null;
    let levelChart = null;
    let tempHistoryChart = null;
    let levelHistoryChart = null;
    let operationMode = 'manual';
    let setpoints = {
        temp: {
            min: 20.0,
            max: 30.0
        },
        level: {
            min: 60,
            max: 90
        }
    };

    // Base Chart Configuration
    const baseChartConfig = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    color: '#ffffff',
                    usePointStyle: true,
                    pointStyle: 'circle',
                    padding: 20,
                    font: {
                        family: "'Segoe UI', sans-serif",
                        size: 12
                    }
                }
            },
            title: {
                display: true,
                color: '#ffffff',
                font: {
                    family: "'Segoe UI', sans-serif",
                    size: 16,
                    weight: '500'
                },
                padding: {
                    top: 10,
                    bottom: 20
                }
            }
        },
        scales: {
            x: {
                grid: {
                    color: 'rgba(255, 255, 255, 0.05)',
                    drawBorder: false
                },
                ticks: {
                    color: '#8a94a7',
                    font: {
                        family: "'Segoe UI', sans-serif",
                        size: 11
                    }
                },
                border: {
                    display: false
                }
            },
            y: {
                grid: {
                    color: 'rgba(255, 255, 255, 0.05)',
                    drawBorder: false
                },
                ticks: {
                    color: '#8a94a7',
                    font: {
                        family: "'Segoe UI', sans-serif",
                        size: 11
                    }
                },
                border: {
                    display: false
                }
            }
        },
        elements: {
            line: {
                tension: 0.4
            },
            point: {
                radius: 3,
                hoverRadius: 5
            }
        }
    };

    // Chart Configurations
    const chartConfigs = {
        temperature: {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Temperatura (°C)',
                        data: [],
                        borderColor: '#6C5DD3',
                        backgroundColor: 'rgba(108, 93, 211, 0.1)',
                        borderWidth: 2,
                        fill: true
                    },
                    {
                        label: 'SetPoint Mínimo',
                        data: [],
                        borderColor: '#e74c3c',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        fill: false
                    },
                    {
                        label: 'SetPoint Máximo',
                        data: [],
                        borderColor: '#2ecc71',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        fill: false
                    }
                ]
            },
            options: {
                ...baseChartConfig,
                plugins: {
                    ...baseChartConfig.plugins,
                    title: {
                        ...baseChartConfig.plugins.title,
                        text: 'Variação de Temperatura'
                    }
                }
            }
        },
        level: {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Nível (%)',
                        data: [],
                        borderColor: '#00B5D8',
                        backgroundColor: 'rgba(0, 181, 216, 0.1)',
                        borderWidth: 2,
                        fill: true
                    },
                    {
                        label: 'SetPoint Mínimo',
                        data: [],
                        borderColor: '#e74c3c',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        fill: false
                    },
                    {
                        label: 'SetPoint Máximo',
                        data: [],
                        borderColor: '#2ecc71',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        fill: false
                    }
                ]
            },
            options: {
                ...baseChartConfig,
                plugins: {
                    ...baseChartConfig.plugins,
                    title: {
                        ...baseChartConfig.plugins.title,
                        text: 'Nível da Água'
                    }
                },
                scales: {
                    ...baseChartConfig.scales,
                    y: {
                        ...baseChartConfig.scales.y,
                        min: 0,
                        max: 100
                    }
                }
            }
        }
    };

    // Initialize Charts
    function initCharts() {
        const tempCtx = document.getElementById('temperatureChart')?.getContext('2d');
        const levelCtx = document.getElementById('levelChart')?.getContext('2d');
        
        if (tempCtx) {
            temperatureChart = new Chart(tempCtx, chartConfigs.temperature);
            updateChartHeader('temperatureChart', setpoints.temp);
        }
        if (levelCtx) {
            levelChart = new Chart(levelCtx, chartConfigs.level);
            updateChartHeader('levelChart', setpoints.level);
        }

        // History charts
        const tempHistoryCtx = document.getElementById('tempHistoryChart')?.getContext('2d');
        const levelHistoryCtx = document.getElementById('levelHistoryChart')?.getContext('2d');

        if (tempHistoryCtx) {
            tempHistoryChart = new Chart(tempHistoryCtx, {
                ...chartConfigs.temperature,
                options: {
                    ...chartConfigs.temperature.options,
                    plugins: {
                        ...chartConfigs.temperature.options.plugins,
                        title: {
                            ...chartConfigs.temperature.options.plugins.title,
                            text: 'Histórico de Temperatura'
                        }
                    }
                }
            });
        }

        if (levelHistoryCtx) {
            levelHistoryChart = new Chart(levelHistoryCtx, {
                ...chartConfigs.level,
                options: {
                    ...chartConfigs.level.options,
                    plugins: {
                        ...chartConfigs.level.options.plugins,
                        title: {
                            ...chartConfigs.level.options.plugins.title,
                            text: 'Histórico do Nível da Água'
                        }
                    }
                }
            });
        }
    }

    // Update Chart Header
    function updateChartHeader(chartId, setpoints) {
        const chartHeader = document.querySelector(`#${chartId}`).closest('.chart-card').querySelector('.chart-header');
        const existingStats = chartHeader.querySelector('.chart-stats');
        
        if (!existingStats) {
            const statsDiv = document.createElement('div');
            statsDiv.className = 'chart-stats';
            
            statsDiv.innerHTML = `
                <div class="stat-item">
                    <span class="stat-label">SetPoint Min</span>
                    <span class="stat-value">${setpoints.min}${chartId.includes('temperature') ? '°C' : '%'}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">SetPoint Max</span>
                    <span class="stat-value">${setpoints.max}${chartId.includes('temperature') ? '°C' : '%'}</span>
                </div>
            `;
            
            chartHeader.appendChild(statsDiv);
        }
    }

    // Update Charts
    function updateCharts(data, isHistorical = false) {
        if (!isValidData(data)) {
            console.log('No valid data available');
            return;
        }

        const validData = data.filter(reading => reading && (reading.temperature !== null || reading.level !== null));
        
        if (validData.length === 0) {
            console.log('No valid readings found in data');
            return;
        }

        const labels = validData.map(reading => {
            const date = new Date(reading.timestamp);
            return isHistorical ? date.toLocaleDateString() : date.toLocaleTimeString();
        });

        // Update temperature charts
        const temperatures = validData.map(reading => reading.temperature ?? null);
        const tempMinSetpoints = new Array(labels.length).fill(setpoints.temp.min);
        const tempMaxSetpoints = new Array(labels.length).fill(setpoints.temp.max);

        const tempChartData = {
            labels,
            datasets: [
                {
                    ...chartConfigs.temperature.data.datasets[0],
                    data: temperatures
                },
                {
                    ...chartConfigs.temperature.data.datasets[1],
                    data: tempMinSetpoints
                },
                {
                    ...chartConfigs.temperature.data.datasets[2],
                    data: tempMaxSetpoints
                }
            ]
        };

        if (temperatureChart && !isHistorical) {
            temperatureChart.data = tempChartData;
            temperatureChart.update();
        }

        if (tempHistoryChart && isHistorical) {
            tempHistoryChart.data = tempChartData;
            tempHistoryChart.update();
        }

        // Update level charts
        const levels = validData.map(reading => reading.level ?? null);
        const levelMinSetpoints = new Array(labels.length).fill(setpoints.level.min);
        const levelMaxSetpoints = new Array(labels.length).fill(setpoints.level.max);

        const levelChartData = {
            labels,
            datasets: [
                {
                    ...chartConfigs.level.data.datasets[0],
                    data: levels
                },
                {
                    ...chartConfigs.level.data.datasets[1],
                    data: levelMinSetpoints
                },
                {
                    ...chartConfigs.level.data.datasets[2],
                    data: levelMaxSetpoints
                }
            ]
        };

        if (levelChart && !isHistorical) {
            levelChart.data = levelChartData;
            levelChart.update();
        }

        if (levelHistoryChart && isHistorical) {
            levelHistoryChart.data = levelChartData;
            levelHistoryChart.update();
        }

        if (isHistorical) {
            updateStats(validData);
        }
        updateDeviceStatus(validData[0]);
    }

    function isValidData(data) {
        return Array.isArray(data) && data.length > 0 && data.some(reading => 
            reading && (reading.temperature !== null || reading.level !== null)
        );
    }

    function updateStats(data) {
        if (!Array.isArray(data) || data.length === 0) return;

        // Temperature Stats
        const temps = data.map(d => d.temperature).filter(t => t !== null);
        if (temps.length > 0) {
            const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
            const maxTemp = Math.max(...temps);
            const minTemp = Math.min(...temps);

            document.getElementById('temp-avg').textContent = `${avgTemp.toFixed(1)}°C`;
            document.getElementById('temp-max').textContent = `${maxTemp.toFixed(1)}°C`;
            document.getElementById('temp-min').textContent = `${minTemp.toFixed(1)}°C`;
        }

        // Level Stats
        const levels = data.map(d => d.level).filter(l => l !== null);
        if (levels.length > 0) {
            const avgLevel = levels.reduce((a, b) => a + b, 0) / levels.length;
            const maxLevel = Math.max(...levels);
            const minLevel = Math.min(...levels);

            document.getElementById('level-avg').textContent = `${avgLevel.toFixed(1)}%`;
            document.getElementById('level-max').textContent = `${maxLevel.toFixed(1)}%`;
            document.getElementById('level-min').textContent = `${minLevel.toFixed(1)}%`;
        }
    }

    function updateDeviceStatus(latestData) {
        if (!latestData) return;

        const devices = {
            bomba: {
                statusElement: document.getElementById('pump-status'),
                modeElement: document.getElementById('pump-mode'),
                status: latestData.pump_status
            },
            aquecedor: {
                statusElement: document.getElementById('heater-status'),
                modeElement: document.getElementById('heater-mode'),
                status: latestData.heater_status
            }
        };

        Object.entries(devices).forEach(([device, info]) => {
            if (info.statusElement) {
                info.statusElement.textContent = info.status ? 'Ligado' : 'Desligado';
                info.statusElement.className = `status ${info.status ? 'active' : 'inactive'}`;
            }
            if (info.modeElement) {
                info.modeElement.textContent = operationMode;
            }
        });
    }

    // Load Latest Data
    async function loadLatestData() {
        try {
            const response = await fetch('/api/temperature/latest');
            if (!response.ok) {
                throw new Error('Erro ao carregar dados');
            }
            
            const data = await response.json();
            
            if (!isValidData(data)) {
                console.log('No latest data available');
                return;
            }
            
            updateCharts(data, false);
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
        }
    }

    // Load Data by Date Range
    async function loadData(startDate, endDate) {
        try {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            const response = await fetch(`/api/temperature?startDate=${start.toISOString()}&endDate=${end.toISOString()}`);
            if (!response.ok) {
                throw new Error('Erro ao carregar dados');
            }
            
            const data = await response.json();
            
            if (!isValidData(data)) {
                console.log('No data available for the selected period');
                return;
            }
            
            updateCharts(data, true);
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            alert('Erro ao carregar dados históricos');
        }
    }

    // Setup Event Listeners
    function setupEventListeners() {
        const filterButton = document.getElementById('filter-button');
        if (filterButton) {
            filterButton.addEventListener('click', () => {
                const startDate = document.getElementById('startDate').value;
                const endDate = document.getElementById('endDate').value;

                if (!startDate || !endDate) {
                    alert('Por favor, selecione as datas inicial e final');
                    return;
                }

                loadData(startDate, endDate);
            });
        }
    }

    // Initialize
    function init() {
        initCharts();
        setupEventListeners();
        
        // Set initial date range
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 1);

        // Format dates for date input (YYYY-MM-DD)
        document.getElementById('startDate').value = start.toISOString().split('T')[0];
        document.getElementById('endDate').value = end.toISOString().split('T')[0];

        // Load initial data
        loadData(start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
        
        // Start periodic updates for main dashboard
        loadLatestData();
        setInterval(loadLatestData, 5000);
    }

    init();
});