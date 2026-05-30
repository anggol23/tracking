import { all } from '../database.js';

// Get coordinate history for a specific device in a date/time range
export const getDeviceHistory = async (req, res) => {
  const { deviceId } = req.params;
  const { start, end } = req.query; // Expect ISO or standard datetime strings

  if (!start || !end) {
    return res.status(400).json({ message: 'Start and end datetimes are required.' });
  }

  try {
    const history = await all(
      'SELECT id, latitude, longitude, speed, timestamp FROM history WHERE deviceId = ? AND timestamp BETWEEN ? AND ? ORDER BY timestamp ASC',
      [deviceId, start, end]
    );

    res.json(history);
  } catch (error) {
    console.error('Error fetching device history:', error);
    res.status(500).json({ message: 'Error retrieving tracking history.' });
  }
};

// Get recent alerts
export const getRecentAlerts = async (req, res) => {
  try {
    const alerts = await all(`
      SELECT a.*, d.name as deviceName 
      FROM alerts a
      JOIN devices d ON a.deviceId = d.id
      ORDER BY a.timestamp DESC 
      LIMIT 50
    `);
    
    // Convert boolean resolved field
    const parsedAlerts = alerts.map(a => ({
      ...a,
      resolved: !!a.resolved
    }));

    res.json(parsedAlerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ message: 'Error retrieving recent alerts.' });
  }
};
