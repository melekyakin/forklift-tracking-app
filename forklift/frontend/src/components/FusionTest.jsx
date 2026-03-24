import React, { useState, useEffect } from 'react';
import apiClient from '../utils/axiosConfig';
import './FusionTest.css';

const FusionTest = () => {
  const [forkliftId, setForkliftId] = useState('FL-01');
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);

  // Durumu periyodik olarak kontrol et
  useEffect(() => {
    if (forkliftId) {
      checkState();
      const interval = setInterval(checkState, 2000);
      return () => clearInterval(interval);
    }
  }, [forkliftId]);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev.slice(-19), { timestamp, message, type }]);
  };

  const sendGPS = async () => {
    setLoading(true);
    try {
      const lat = 40.74201 + (Math.random() - 0.5) * 0.001;
      const lng = 30.33402 + (Math.random() - 0.5) * 0.001;
      const accuracy = 5 + Math.random() * 5;

      const response = await apiClient.post('/api/iot/gps', {
        forkliftId,
        lat,
        lng,
        accuracy,
        timestamp: Date.now()
      });

      addLog(`✅ GPS gönderildi: lat=${lat.toFixed(6)}, lng=${lng.toFixed(6)}, accuracy=${accuracy.toFixed(1)}m`, 'success');
      checkState();
    } catch (error) {
      addLog(`❌ GPS gönderme hatası: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const sendIMU = async (moving) => {
    setLoading(true);
    try {
      const acc = moving ? 0.15 + Math.random() * 0.1 : 0.05 + Math.random() * 0.05;

      const response = await apiClient.post('/api/iot/imu', {
        forkliftId,
        moving,
        acc,
        timestamp: Date.now()
      });

      addLog(`✅ IMU gönderildi: moving=${moving}, acc=${acc.toFixed(3)}`, 'success');
      checkState();
    } catch (error) {
      addLog(`❌ IMU gönderme hatası: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const checkState = async () => {
    try {
      const response = await apiClient.get(`/api/iot/forklift/${forkliftId}/state`);
      setState(response.data);
    } catch (error) {
      if (error.response?.status !== 404) {
        console.error('Durum kontrolü hatası:', error);
      }
    }
  };

  const testScenario = async (scenario) => {
    setLoading(true);
    addLog(`🧪 Senaryo başlatılıyor: ${scenario.name}`, 'info');

    try {
      switch (scenario.id) {
        case 'normal':
          await sendIMU(true);
          await new Promise(r => setTimeout(r, 500));
          await sendGPS();
          break;
        case 'titresim':
          await sendIMU(true);
          break;
        case 'idle':
          await sendIMU(false);
          await new Promise(r => setTimeout(r, 500));
          await sendGPS();
          break;
        case 'kotu-gps':
          await sendIMU(true);
          await new Promise(r => setTimeout(r, 500));
          // Kötü GPS gönder
          await apiClient.post('/api/iot/gps', {
            forkliftId,
            lat: 40.74201,
            lng: 30.33402,
            accuracy: 15.8,
            timestamp: Date.now()
          });
          addLog('✅ GPS gönderildi (kötü doğruluk: 15.8m)', 'success');
          break;
      }
      await new Promise(r => setTimeout(r, 1000));
      await checkState();
    } catch (error) {
      addLog(`❌ Senaryo hatası: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const scenarios = [
    { id: 'normal', name: 'Normal Sürüş (IMU + GPS)', icon: '🚜' },
    { id: 'titresim', name: 'Titreşim (IMU var, GPS yok)', icon: '📳' },
    { id: 'idle', name: 'Duruyor (IMU hareket yok)', icon: '🛑' },
    { id: 'kotu-gps', name: 'Kötü GPS Doğruluğu (>10m)', icon: '⚠️' }
  ];

  return (
    <div className="fusion-test">
      <div className="fusion-test-header">
        <h1>GPS + IMU Fusion Test</h1>
        <div className="forklift-id-input">
          <label>Forklift ID:</label>
          <input
            type="text"
            value={forkliftId}
            onChange={(e) => setForkliftId(e.target.value)}
            placeholder="FL-01"
          />
        </div>
      </div>

      <div className="fusion-test-content">
        <div className="test-panel">
          <h2>Manuel Test</h2>
          <div className="button-group">
            <button onClick={() => sendGPS()} disabled={loading}>
              📍 GPS Gönder
            </button>
            <button onClick={() => sendIMU(true)} disabled={loading}>
              📱 IMU (Hareket Var)
            </button>
            <button onClick={() => sendIMU(false)} disabled={loading}>
              📱 IMU (Hareket Yok)
            </button>
            <button onClick={checkState} disabled={loading}>
              🔍 Durumu Kontrol Et
            </button>
          </div>

          <h2>Test Senaryoları</h2>
          <div className="scenarios">
            {scenarios.map(scenario => (
              <button
                key={scenario.id}
                className="scenario-btn"
                onClick={() => testScenario(scenario)}
                disabled={loading}
              >
                <span className="scenario-icon">{scenario.icon}</span>
                <span>{scenario.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="state-panel">
          <h2>Forklift Durumu</h2>
          {state ? (
            <div className="state-info">
              <div className="state-badge" data-state={state.state}>
                {state.state === 'MOVING' ? '🚜' : '🛑'} {state.state}
              </div>
              <div className="state-details">
                <div className="detail-item">
                  <strong>Hareket Türü:</strong>
                  <span>{state.movementType || 'bilinmiyor'}</span>
                </div>
                {state.location && (
                  <>
                    <div className="detail-item">
                      <strong>Konum:</strong>
                      <span>
                        {state.location.lat.toFixed(6)}, {state.location.lng.toFixed(6)}
                      </span>
                    </div>
                    <div className="detail-item">
                      <strong>Doğruluk:</strong>
                      <span>{state.location.accuracy?.toFixed(1)}m</span>
                    </div>
                    <div className="detail-item">
                      <strong>Kaynak:</strong>
                      <span>{state.location.source}</span>
                    </div>
                  </>
                )}
                {state.imu && (
                  <div className="detail-item">
                    <strong>IMU:</strong>
                    <span>
                      moving={state.imu.moving ? '✅' : '❌'}, 
                      age={(state.imu.age / 1000).toFixed(1)}s
                    </span>
                  </div>
                )}
                {state.gps && (
                  <div className="detail-item">
                    <strong>GPS:</strong>
                    <span>
                      age={(state.gps.age / 1000).toFixed(1)}s, 
                      accuracy={state.gps.accuracy?.toFixed(1)}m
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="no-state">
              <p>Henüz veri yok. GPS veya IMU verisi gönderin.</p>
            </div>
          )}
        </div>
      </div>

      <div className="logs-panel">
        <h2>Loglar</h2>
        <div className="logs">
          {logs.length === 0 ? (
            <p className="no-logs">Henüz log yok</p>
          ) : (
            logs.map((log, index) => (
              <div key={index} className={`log-item log-${log.type}`}>
                <span className="log-time">{log.timestamp}</span>
                <span className="log-message">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default FusionTest;

