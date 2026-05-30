import crypto from 'crypto';
import { run, get, all } from '../database.js';

// Get all devices
export const getAllDevices = async (req, res) => {
  try {
    const devices = await all('SELECT * FROM devices ORDER BY name ASC');
    res.json(devices);
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ message: 'Error retrieving devices.' });
  }
};

// Create a new device
export const createDevice = async (req, res) => {
  const { name, divisi, location_group } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Device name is required.' });
  }

  // Generate a random token for device authentication
  const token = `dev_${crypto.randomBytes(24).toString('hex')}`;

  try {
    const result = await run(
      'INSERT INTO devices (name, token, divisi, location_group, status) VALUES (?, ?, ?, ?, ?)',
      [name, token, divisi || 'General', location_group || 'Headquarters', 'offline']
    );

    const newDevice = await get('SELECT * FROM devices WHERE id = ?', [result.id]);
    res.status(201).json(newDevice);
  } catch (error) {
    console.error('Error creating device:', error);
    res.status(500).json({ message: 'Error creating device.' });
  }
};

// Update an existing device
export const updateDevice = async (req, res) => {
  const { id } = req.params;
  const { name, divisi, location_group } = req.body;

  try {
    const device = await get('SELECT id FROM devices WHERE id = ?', [id]);
    if (!device) {
      return res.status(404).json({ message: 'Device not found.' });
    }

    await run(
      'UPDATE devices SET name = COALESCE(?, name), divisi = COALESCE(?, divisi), location_group = COALESCE(?, location_group) WHERE id = ?',
      [name, divisi, location_group, id]
    );

    const updated = await get('SELECT * FROM devices WHERE id = ?', [id]);
    res.json(updated);
  } catch (error) {
    console.error('Error updating device:', error);
    res.status(500).json({ message: 'Error updating device.' });
  }
};

// Delete a device
export const deleteDevice = async (req, res) => {
  const { id } = req.params;

  try {
    const device = await get('SELECT id FROM devices WHERE id = ?', [id]);
    if (!device) {
      return res.status(404).json({ message: 'Device not found.' });
    }

    await run('DELETE FROM devices WHERE id = ?', [id]);
    res.json({ message: 'Device deleted successfully.', id });
  } catch (error) {
    console.error('Error deleting device:', error);
    res.status(500).json({ message: 'Error deleting device.' });
  }
};

// Regenerate authentication token for a device
export const regenerateToken = async (req, res) => {
  const { id } = req.params;
  const newToken = `dev_${crypto.randomBytes(24).toString('hex')}`;

  try {
    const device = await get('SELECT id FROM devices WHERE id = ?', [id]);
    if (!device) {
      return res.status(404).json({ message: 'Device not found.' });
    }

    await run('UPDATE devices SET token = ? WHERE id = ?', [newToken, id]);
    res.json({ message: 'Token regenerated successfully.', token: newToken });
  } catch (error) {
    console.error('Error regenerating token:', error);
    res.status(500).json({ message: 'Error regenerating token.' });
  }
};
