import { run, get, all } from '../database.js';

// Get all geofences
export const getAllGeofences = async (req, res) => {
  try {
    const geofences = await all(`
      SELECT g.*, d.name as deviceName 
      FROM geofences g
      LEFT JOIN devices d ON g.deviceId = d.id
      ORDER BY g.id DESC
    `);
    
    // Parse coordinates from string back to JSON objects
    const parsedGeofences = geofences.map(g => ({
      ...g,
      coordinates: JSON.parse(g.coordinates),
      active: !!g.active
    }));

    res.json(parsedGeofences);
  } catch (error) {
    console.error('Error fetching geofences:', error);
    res.status(500).json({ message: 'Error retrieving geofences.' });
  }
};

// Create a new geofence
export const createGeofence = async (req, res) => {
  const { name, type, coordinates, deviceId } = req.body;

  if (!name || !type || !coordinates) {
    return res.status(400).json({ message: 'Name, type, and coordinates are required.' });
  }

  if (type !== 'circle' && type !== 'polygon') {
    return res.status(400).json({ message: 'Invalid geofence type. Must be circle or polygon.' });
  }

  try {
    // Check if device exists if deviceId is provided
    if (deviceId) {
      const device = await get('SELECT id FROM devices WHERE id = ?', [deviceId]);
      if (!device) {
        return res.status(404).json({ message: 'Device not found.' });
      }
    }

    const coordinatesStr = JSON.stringify(coordinates);
    const result = await run(
      'INSERT INTO geofences (name, type, coordinates, deviceId, active) VALUES (?, ?, ?, ?, 1)',
      [name, type, coordinatesStr, deviceId || null]
    );

    const newGeofence = await get('SELECT * FROM geofences WHERE id = ?', [result.id]);
    res.status(201).json({
      ...newGeofence,
      coordinates,
      active: true
    });
  } catch (error) {
    console.error('Error creating geofence:', error);
    res.status(500).json({ message: 'Error creating geofence.' });
  }
};

// Delete a geofence
export const deleteGeofence = async (req, res) => {
  const { id } = req.params;

  try {
    const geofence = await get('SELECT id FROM geofences WHERE id = ?', [id]);
    if (!geofence) {
      return res.status(404).json({ message: 'Geofence not found.' });
    }

    await run('DELETE FROM geofences WHERE id = ?', [id]);
    res.json({ message: 'Geofence deleted successfully.', id });
  } catch (error) {
    console.error('Error deleting geofence:', error);
    res.status(500).json({ message: 'Error deleting geofence.' });
  }
};
