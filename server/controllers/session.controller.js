import { Session } from '../models/Session.js';

// Generate a random 6-character code
const generateCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const createSession = async (req, res) => {
  try {
    let code = generateCode();
    // Ensure code uniqueness
    while (await Session.findOne({ code, isActive: true })) {
      code = generateCode();
    }

    const session = await Session.create({
      code,
      senderId: req.user.id,
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // Expires in 2 hours
    });

    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const verifySession = async (req, res) => {
  try {
    const { code } = req.params;
    const session = await Session.findOne({ code, isActive: true }).populate('senderId', 'name email');

    if (!session) return res.status(404).json({ message: 'Session not found or inactive' });
    if (session.expiresAt < new Date()) {
      session.isActive = false;
      await session.save();
      return res.status(400).json({ message: 'Session expired' });
    }

    res.status(200).json(session);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const stopSession = async (req, res) => {
  try {
    const { code } = req.params;
    const session = await Session.findOne({ code, senderId: req.user.id });
    if (!session) return res.status(404).json({ message: 'Session not found' });

    session.isActive = false;
    await session.save();

    res.status(200).json({ message: 'Session stopped' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
