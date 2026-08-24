import Shift from '../Models/ShiftModel.js';
import User from '../Models/UserModel.js';

export const getAllShifts = async (req, res) => {
  try {
    const shifts = await Shift.find({ isActive: true })
      .populate('assignedUsers', 'username email role department designation');
    res.status(200).json(shifts);
  } catch (error) {
    console.error("Error getting all shifts:", error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getMyShift = async (req, res) => {
  try {
    const shift = await Shift.findOne({ assignedUsers: req.user.id, isActive: true })
      .populate('assignedUsers', 'username email role department designation');
    if (!shift) {
      return res.status(200).json(null);
    }
    res.status(200).json(shift);
  } catch (error) {
    console.error("Error getting my shift:", error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const createShift = async (req, res) => {
  try {
    const newShift = new Shift(req.body);
    await newShift.save();
    res.status(201).json(newShift);
  } catch (error) {
    console.error("Error creating shift:", error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const updateShift = async (req, res) => {
  try {
    const { id } = req.params;
    const shift = await Shift.findById(id);
    if (!shift) {
      return res.status(404).json({ message: 'Shift not found' });
    }
    
    Object.assign(shift, req.body);
    
    if (req.body.startTime || req.body.endTime) {
      shift.isNightShift = shift.endTime < shift.startTime;
    }
    
    await shift.save();
    res.status(200).json(shift);
  } catch (error) {
    console.error("Error updating shift:", error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const deleteShift = async (req, res) => {
  try {
    const { id } = req.params;
    const shift = await Shift.findById(id);
    if (!shift) {
      return res.status(404).json({ message: 'Shift not found' });
    }
    shift.isActive = false;
    await shift.save();
    res.status(200).json({ message: 'Shift deleted successfully' });
  } catch (error) {
    console.error("Error deleting shift:", error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const assignUsersToShift = async (req, res) => {
  try {
    const { id } = req.params;
    const { userIds } = req.body;
    
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'userIds must be a non-empty array' });
    }

    const shift = await Shift.findById(id);
    if (!shift) {
      return res.status(404).json({ message: 'Shift not found' });
    }

    await Shift.updateMany(
      {},
      { $pull: { assignedUsers: { $in: userIds } } }
    );

    const existingUsers = (shift.assignedUsers || []).map(u => u.toString());
    const newUsers = userIds.filter(u => !existingUsers.includes(u.toString()));
    
    shift.assignedUsers.push(...newUsers);
    await shift.save();

    await User.updateMany(
      { _id: { $in: userIds } },
      { $set: { shiftId: shift._id } }
    );

    const updatedShift = await Shift.findById(id).populate('assignedUsers', 'username email role department designation');
    res.status(200).json(updatedShift);
  } catch (error) {
    console.error("Error assigning users to shift:", error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const removeUserFromShift = async (req, res) => {
  try {
    const { id, userId } = req.params;
    
    const shift = await Shift.findById(id);
    if (!shift) {
      return res.status(404).json({ message: 'Shift not found' });
    }

    shift.assignedUsers = (shift.assignedUsers || []).filter(u => u.toString() !== userId.toString());
    await shift.save();

    await User.findByIdAndUpdate(userId, { $set: { shiftId: null } });

    const updatedShift = await Shift.findById(id).populate('assignedUsers', 'username email role department designation');
    res.status(200).json(updatedShift);
  } catch (error) {
    console.error("Error removing user from shift:", error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const changeUserShift = async (req, res) => {
  try {
    const { userId, newShiftId } = req.body;
    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }
    
    await Shift.updateMany(
      {},
      { $pull: { assignedUsers: userId } }
    );

    let newShift = null;
    if (newShiftId) {
      newShift = await Shift.findById(newShiftId);
      if (newShift) {
        if (!newShift.assignedUsers.map(u => u.toString()).includes(userId.toString())) {
          newShift.assignedUsers.push(userId);
          await newShift.save();
        }
      }
    }

    await User.findByIdAndUpdate(userId, { $set: { shiftId: newShiftId || null } });

    res.status(200).json({ message: 'User shift changed successfully', newShift });
  } catch (error) {
    console.error("Error changing user shift:", error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
