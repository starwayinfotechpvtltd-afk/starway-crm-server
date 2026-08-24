import Attendance from '../Models/Attendance.js';
import AttendanceConfig from '../Models/AttendanceConfigModel.js';
import Shift from '../Models/ShiftModel.js';
import User from '../Models/UserModel.js';

const haversineDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371000; // meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getTodayDateString = () => {
  const today = new Date();
  return today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
};

const getDayName = () => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date().getDay()];
};

const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

export const getConfig = async (req, res) => {
  try {
    let config = await AttendanceConfig.findOne();
    if (!config) {
      config = await AttendanceConfig.create({
        offices: [{
          name: 'Kolkata Office',
          latitude: 22.5394232,
          longitude: 88.3766183,
          radiusMeters: 100,
          isDefault: true,
          isActive: true
        }],
        blockClockInOnFail: true
      });
    }
    res.status(200).json(config);
  } catch (error) {
    console.error("Error getting config:", error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const updateConfig = async (req, res) => {
  try {
    const { offices, blockClockInOnFail } = req.body;
    let config = await AttendanceConfig.findOne();
    if (!config) {
      config = new AttendanceConfig();
    }
    if (offices !== undefined) config.offices = offices;
    if (blockClockInOnFail !== undefined) config.blockClockInOnFail = blockClockInOnFail;
    config.updatedBy = req.user.id;
    await config.save();
    res.status(200).json(config);
  } catch (error) {
    console.error("Error updating config:", error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const clockIn = async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      return res.status(403).json({ message: 'Admins do not need attendance.' });
    }

    const { lat, lng, accuracyMeters } = req.body;
    const dateStr = getTodayDateString();

    const existing = await Attendance.findOne({
      user: req.user.id,
      date: dateStr,
      status: { $in: ['active', 'on_break'] }
    });

    if (existing) {
      return res.status(400).json({ message: 'Already clocked in for today.' });
    }

    let config = await AttendanceConfig.findOne();
    if (!config) {
      config = { offices: [], blockClockInOnFail: false };
    }

    let verified = false;
    let minDistance = Infinity;

    if (lat !== undefined && lng !== undefined) {
      for (const office of config.offices) {
        if (!office.isActive) continue;
        const dist = haversineDistance(lat, lng, office.latitude, office.longitude);
        if (dist < minDistance) minDistance = dist;
        if (dist <= office.radiusMeters) {
          verified = true;
          break;
        }
      }
    }

    if (config.blockClockInOnFail && !verified) {
      return res.status(403).json({ message: 'You are outside the office perimeter. Clock-in is not allowed.' });
    }

    const shift = await Shift.findOne({
      assignedUsers: req.user.id,
      isActive: true
    });

    const now = new Date();
    const currentHHMM = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    let shiftComplianceStatus = 'unassigned';
    let lateMinutes = 0;
    
    const dayName = getDayName();

    if (shift) {
      if (shift.workDays.includes(dayName)) {
        const shiftStartMins = parseTimeToMinutes(shift.startTime);
        const currentMins = parseTimeToMinutes(currentHHMM);
        
        if (currentMins > shiftStartMins + shift.allowedLateMinutes) {
          shiftComplianceStatus = 'late';
          lateMinutes = currentMins - shiftStartMins;
        } else {
          shiftComplianceStatus = 'on_time';
        }
      } else {
        // Saturday or flexible weekend working: automatically marked on_time
        shiftComplianceStatus = 'on_time';
      }
    } else {
      shiftComplianceStatus = 'on_time';
    }

    let allowedBreakMinutes = shift?.allowedBreakMinutes ?? 60;
    let targetWorkMinutes = 480; // default 8 hours
    if (shift?.startTime && shift?.endTime) {
      const sMins = parseTimeToMinutes(shift.startTime);
      const eMins = parseTimeToMinutes(shift.endTime);
      let durationMins = eMins - sMins;
      if (durationMins < 0) durationMins += 1440; // night shift crosses midnight
      targetWorkMinutes = Math.max(60, durationMins - allowedBreakMinutes);
    }

    const attendance = await Attendance.create({
      user: req.user.id,
      date: dateStr,
      clockIn: now,
      status: 'active',
      shiftId: shift ? shift._id : undefined,
      shiftName: shift ? shift.name : undefined,
      shiftStart: shift ? shift.startTime : undefined,
      shiftEnd: shift ? shift.endTime : undefined,
      allowedBreakMinutes,
      targetWorkMinutes,
      shiftComplianceStatus,
      lateMinutes,
      clockInLocation: { lat, lng, accuracyMeters, verified }
    });

    res.status(200).json({ message: 'Clocked in successfully', attendance });
  } catch (error) {
    console.error("Error clocking in:", error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const clockOut = async (req, res) => {
  try {
    const { lat, lng, accuracyMeters } = req.body;
    const dateStr = getTodayDateString();

    const attendance = await Attendance.findOne({
      user: req.user.id,
      date: dateStr,
      status: { $in: ['active', 'on_break'] }
    });

    if (!attendance) {
      return res.status(404).json({ message: 'Active attendance record not found for today.' });
    }

    let config = await AttendanceConfig.findOne();
    if (!config) {
      config = { offices: [], blockClockInOnFail: false };
    }

    let verified = false;
    if (lat !== undefined && lng !== undefined) {
      for (const office of config.offices) {
        if (!office.isActive) continue;
        const dist = haversineDistance(lat, lng, office.latitude, office.longitude);
        if (dist <= office.radiusMeters) {
          verified = true;
          break;
        }
      }
    }

    const now = new Date();
    
    if (attendance.status === 'on_break') {
      const lastBreak = attendance.breaks[attendance.breaks.length - 1];
      if (lastBreak && !lastBreak.end) {
        lastBreak.end = now;
        lastBreak.durationMinutes = Math.round((now - lastBreak.start) / 60000);
      }
    }

    attendance.clockOut = now;
    attendance.status = 'clocked_out';
    attendance.clockOutLocation = { lat, lng, accuracyMeters, verified };

    let totalBreak = 0;
    for (const b of attendance.breaks) {
      if (b.durationMinutes) totalBreak += b.durationMinutes;
    }
    attendance.totalBreakMinutes = totalBreak;

    const totalSessionMins = Math.round((now - attendance.clockIn) / 60000);
    attendance.totalWorkMinutes = Math.max(0, totalSessionMins - totalBreak);

    // Check Excess Break limit (Orange flag)
    const allowedBreak = attendance.allowedBreakMinutes || 60;
    if (attendance.totalBreakMinutes > allowedBreak) {
      attendance.isExcessBreak = true;
      attendance.excessBreakMinutes = attendance.totalBreakMinutes - allowedBreak;
    } else {
      attendance.isExcessBreak = false;
      attendance.excessBreakMinutes = 0;
    }

    // Check Incomplete Target Work Hours (Red flag)
    const targetWork = attendance.targetWorkMinutes || 480;
    if (attendance.totalWorkMinutes < targetWork) {
      attendance.isUnderWorkHours = true;
      attendance.underWorkMinutes = targetWork - attendance.totalWorkMinutes;
    } else {
      attendance.isUnderWorkHours = false;
      attendance.underWorkMinutes = 0;
    }

    const currentHHMM = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    
    if (attendance.shiftEnd && attendance.shiftComplianceStatus !== 'unassigned') {
      const isNightShift = attendance.shiftEnd < attendance.shiftStart;
      
      if (isNightShift) {
        if (currentHHMM < attendance.shiftEnd) {
          const currentMins = parseTimeToMinutes(currentHHMM);
          const shiftEndMins = parseTimeToMinutes(attendance.shiftEnd);
          attendance.earlyDepartureMinutes = Math.max(0, shiftEndMins - currentMins);
          if (attendance.earlyDepartureMinutes > 0 && attendance.shiftComplianceStatus !== 'late') {
            attendance.shiftComplianceStatus = 'early_departure';
          }
        }
      } else {
        if (currentHHMM < attendance.shiftEnd) {
          const currentMins = parseTimeToMinutes(currentHHMM);
          const shiftEndMins = parseTimeToMinutes(attendance.shiftEnd);
          attendance.earlyDepartureMinutes = Math.max(0, shiftEndMins - currentMins);
          if (attendance.earlyDepartureMinutes > 0 && attendance.shiftComplianceStatus !== 'late') {
            attendance.shiftComplianceStatus = 'early_departure';
          }
        }
      }
    }

    await attendance.save();

    res.status(200).json({ message: 'Clocked out successfully', attendance });
  } catch (error) {
    console.error("Error clocking out:", error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const startBreak = async (req, res) => {
  try {
    const dateStr = getTodayDateString();
    const attendance = await Attendance.findOne({
      user: req.user.id,
      date: dateStr,
      status: 'active'
    });

    if (!attendance) {
      return res.status(404).json({ message: 'Active attendance not found or already on break.' });
    }

    attendance.breaks.push({ start: new Date() });
    attendance.status = 'on_break';
    await attendance.save();

    res.status(200).json({ message: 'Break started', attendance });
  } catch (error) {
    console.error("Error starting break:", error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const endBreak = async (req, res) => {
  try {
    const dateStr = getTodayDateString();
    const attendance = await Attendance.findOne({
      user: req.user.id,
      date: dateStr,
      status: 'on_break'
    });

    if (!attendance) {
      return res.status(404).json({ message: 'Not currently on break.' });
    }

    const lastBreak = attendance.breaks[attendance.breaks.length - 1];
    if (lastBreak && !lastBreak.end) {
      const now = new Date();
      lastBreak.end = now;
      lastBreak.durationMinutes = Math.round((now - lastBreak.start) / 60000);
    }
    
    attendance.status = 'active';
    await attendance.save();

    res.status(200).json({ message: 'Break ended', attendance });
  } catch (error) {
    console.error("Error ending break:", error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getTodayStatus = async (req, res) => {
  try {
    const dateStr = getTodayDateString();
    const attendance = await Attendance.findOne({
      user: req.user.id,
      date: dateStr
    }).sort({ createdAt: -1 });

    if (!attendance) {
      return res.status(200).json({ status: 'not_clocked_in', attendance: null, currentSessionMinutes: 0 });
    }

    let currentSessionMinutes = attendance.totalWorkMinutes || 0;
    if (attendance.status === 'active' || attendance.status === 'on_break') {
      const now = new Date();
      let totalBreak = attendance.totalBreakMinutes || 0;
      if (attendance.status === 'on_break') {
        const lastBreak = attendance.breaks[attendance.breaks.length - 1];
        if (lastBreak && !lastBreak.end) {
          totalBreak += Math.round((now - lastBreak.start) / 60000);
        }
      }
      currentSessionMinutes = Math.max(0, Math.round((now - attendance.clockIn) / 60000) - totalBreak);
    }

    res.status(200).json({ status: attendance.status, attendance, currentSessionMinutes });
  } catch (error) {
    console.error("Error getting today status:", error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getMyAttendance = async (req, res) => {
  try {
    const { month, page = 1, limit = 31 } = req.query;
    
    let query = { user: req.user.id };
    if (month) {
      query.date = { $regex: `^${month}` };
    }

    const records = await Attendance.find(query)
      .populate('shiftId', 'name startTime endTime isNightShift workDays color')
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
      
    const now = new Date();
    const formattedRecords = records.map(r => {
      const doc = r.toObject ? r.toObject() : { ...r };
      if (doc.status === 'active' || doc.status === 'on_break') {
        let currentRunningBreak = 0;
        if (doc.status === 'on_break') {
          const lastBreak = doc.breaks?.[doc.breaks.length - 1];
          if (lastBreak && !lastBreak.end) {
            currentRunningBreak = Math.max(0, Math.round((now - new Date(lastBreak.start)) / 60000));
          }
        }
        let completedBreaks = 0;
        if (doc.breaks && doc.breaks.length > 0) {
          for (const b of doc.breaks) {
            if (b.durationMinutes) completedBreaks += b.durationMinutes;
          }
        }
        const allBreaks = (doc.totalBreakMinutes || 0) + currentRunningBreak;
        doc.totalBreakMinutes = allBreaks;
        doc.totalWorkMinutes = Math.max(0, Math.round((now - new Date(doc.clockIn)) / 60000) - allBreaks);
      }

      const allowedBreak = doc.allowedBreakMinutes || doc.shiftId?.allowedBreakMinutes || 60;
      doc.allowedBreakMinutes = allowedBreak;
      if (doc.totalBreakMinutes > allowedBreak) {
        doc.isExcessBreak = true;
        doc.excessBreakMinutes = doc.totalBreakMinutes - allowedBreak;
      } else {
        doc.isExcessBreak = false;
        doc.excessBreakMinutes = 0;
      }

      const targetWork = doc.targetWorkMinutes || 480;
      doc.targetWorkMinutes = targetWork;
      if (doc.status === 'clocked_out' && doc.totalWorkMinutes < targetWork) {
        doc.isUnderWorkHours = true;
        doc.underWorkMinutes = targetWork - doc.totalWorkMinutes;
      } else {
        doc.isUnderWorkHours = false;
        doc.underWorkMinutes = 0;
      }

      return doc;
    });

    const allMonthRecords = month ? await Attendance.find(query) : records;
    
    let presentDays = allMonthRecords.length;
    let lateDays = allMonthRecords.filter(r => r.shiftComplianceStatus === 'late').length;
    let totalWorkMinutes = formattedRecords.reduce((sum, r) => sum + (r.totalWorkMinutes || 0), 0);
    let totalBreakMinutes = formattedRecords.reduce((sum, r) => sum + (r.totalBreakMinutes || 0), 0);
    
    const stats = {
      present: presentDays,
      presentDays,
      absent: 0,
      absentDays: 0,
      late: lateDays,
      lateDays,
      totalWorkMinutes,
      totalBreakMinutes,
      totalHours: Math.round((totalWorkMinutes / 60) * 10) / 10
    };

    res.status(200).json({ records: formattedRecords, stats });
  } catch (error) {
    console.error("Error getting my attendance:", error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getAllAttendance = async (req, res) => {
  try {
    const { date, startDate, endDate, month, userId, shiftId, status, page = 1, limit = 200 } = req.query;
    
    let query = {};
    if (date) {
      query.date = date;
    } else if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    } else if (startDate) {
      query.date = { $gte: startDate };
    } else if (endDate) {
      query.date = { $lte: endDate };
    } else if (month) {
      query.date = { $regex: `^${month}` };
    }
    
    if (userId) query.user = userId;
    if (shiftId) query.shiftId = shiftId;
    if (status) query.status = status;

    const total = await Attendance.countDocuments(query);
    const records = await Attendance.find(query)
      .populate('user', 'username email role department designation avatar')
      .populate('shiftId', 'name startTime endTime isNightShift workDays color allowedBreakMinutes')
      .sort({ date: -1, clockIn: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const now = new Date();
    const formattedRecords = records.map(r => {
      const doc = r.toObject ? r.toObject() : { ...r };
      if (doc.status === 'active' || doc.status === 'on_break') {
        let currentRunningBreak = 0;
        if (doc.status === 'on_break') {
          const lastBreak = doc.breaks?.[doc.breaks.length - 1];
          if (lastBreak && !lastBreak.end) {
            currentRunningBreak = Math.max(0, Math.round((now - new Date(lastBreak.start)) / 60000));
          }
        }
        let completedBreaks = 0;
        if (doc.breaks && doc.breaks.length > 0) {
          for (const b of doc.breaks) {
            if (b.durationMinutes) completedBreaks += b.durationMinutes;
          }
        }
        const allBreaks = (doc.totalBreakMinutes || 0) + currentRunningBreak;
        doc.totalBreakMinutes = allBreaks;
        doc.totalWorkMinutes = Math.max(0, Math.round((now - new Date(doc.clockIn)) / 60000) - allBreaks);
      }

      const allowedBreak = doc.allowedBreakMinutes || doc.shiftId?.allowedBreakMinutes || 60;
      doc.allowedBreakMinutes = allowedBreak;
      if (doc.totalBreakMinutes > allowedBreak) {
        doc.isExcessBreak = true;
        doc.excessBreakMinutes = doc.totalBreakMinutes - allowedBreak;
      } else {
        doc.isExcessBreak = false;
        doc.excessBreakMinutes = 0;
      }

      const targetWork = doc.targetWorkMinutes || 480;
      doc.targetWorkMinutes = targetWork;
      if (doc.status === 'clocked_out' && doc.totalWorkMinutes < targetWork) {
        doc.isUnderWorkHours = true;
        doc.underWorkMinutes = targetWork - doc.totalWorkMinutes;
      } else {
        doc.isUnderWorkHours = false;
        doc.underWorkMinutes = 0;
      }

      return doc;
    });

    res.status(200).json({
      records: formattedRecords,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error("Error getting all attendance:", error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const isDateWorkingDay = (dateObj, shift, config) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = days[dateObj.getDay()];
  const dateStr = dateObj.getFullYear() + '-' + String(dateObj.getMonth() + 1).padStart(2, '0') + '-' + String(dateObj.getDate()).padStart(2, '0');

  // 1. Check if there is an explicit company-wide Saturday override
  if (dayName === 'Saturday' && config?.workingSaturdayOverrides) {
    const override = config.workingSaturdayOverrides.find(o => o.date === dateStr);
    if (override) {
      return override.isWorking;
    }
  }

  // 2. Sunday is non-working by default unless specified
  if (dayName === 'Sunday') {
    return (shift?.workDays || []).includes('Sunday');
  }

  // 3. Saturday specific logic
  if (dayName === 'Saturday') {
    const rule = shift?.saturdayRule || 'flexible';
    if (rule === 'none') return false;
    if (rule === 'all') return true;
    if (rule === 'flexible') return 'flexible'; // voluntary

    const satIndex = Math.ceil(dateObj.getDate() / 7);
    if (rule === 'alternate_1_3_5') {
      return (satIndex === 1 || satIndex === 3 || satIndex === 5);
    }
    if (rule === 'alternate_2_4') {
      return (satIndex === 2 || satIndex === 4);
    }
  }

  // 4. Regular Mon-Fri workdays
  return shift ? (shift.workDays || []).includes(dayName) : true;
};

export const getTodayBoard = async (req, res) => {
  try {
    const dateStr = getTodayDateString();
    const config = await AttendanceConfig.findOne();
    
    // Only active/non-terminated non-admin staff
    const users = await User.find(
      { 
        role: { $ne: 'admin' },
        employmentStatus: { $nin: ['resigned', 'terminated'] }
      }, 
      'username email role department designation employmentStatus avatar'
    );
    
    const attendances = await Attendance.find({ date: dateStr }).populate('shiftId', 'name startTime endTime isNightShift workDays color allowedBreakMinutes saturdayRule');
    
    const attendancesMap = {};
    for (const att of attendances) {
      attendancesMap[att.user.toString()] = att;
    }

    const shifts = await Shift.find({ isActive: true });
    const shiftMap = {};
    for (const s of shifts) {
      for (const u of s.assignedUsers) {
        if (u) shiftMap[u.toString()] = s;
      }
    }

    const todayDate = new Date();

    const board = users.map(user => {
      const att = attendancesMap[user._id.toString()];
      const shift = shiftMap[user._id.toString()];
      
      // Check if today is a scheduled work day for this user's shift using Saturday rules & overrides
      const workDayStatus = isDateWorkingDay(todayDate, shift, config);
      const isMandatoryWorkDay = workDayStatus === true;
      
      let status = isMandatoryWorkDay ? 'absent' : 'off_duty';
      let totalBreakMinutes = 0;
      let totalWorkMinutes = 0;

      if (att) {
        status = att.status; 
        totalBreakMinutes = att.totalBreakMinutes || 0;
        totalWorkMinutes = att.totalWorkMinutes || 0;

        if (att.status === 'active' || att.status === 'on_break') {
          const now = new Date();
          let currentRunningBreak = 0;
          if (att.status === 'on_break') {
            const lastBreak = att.breaks?.[att.breaks.length - 1];
            if (lastBreak && !lastBreak.end) {
              currentRunningBreak = Math.max(0, Math.round((now - new Date(lastBreak.start)) / 60000));
            }
          }
          const allBreaks = (att.totalBreakMinutes || 0) + currentRunningBreak;
          totalBreakMinutes = allBreaks;
          totalWorkMinutes = Math.max(0, Math.round((now - new Date(att.clockIn)) / 60000) - allBreaks);
        }
      }

      const allowedBreak = att?.allowedBreakMinutes || shift?.allowedBreakMinutes || 60;
      const targetWork = att?.targetWorkMinutes || 480;
      const isExcessBreak = totalBreakMinutes > allowedBreak;
      const excessBreakMinutes = isExcessBreak ? totalBreakMinutes - allowedBreak : 0;
      const isUnderWorkHours = status === 'clocked_out' && totalWorkMinutes < targetWork;
      const underWorkMinutes = isUnderWorkHours ? targetWork - totalWorkMinutes : 0;
      
      return {
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          department: user.department,
          designation: user.designation,
          avatar: user.avatar,
          employmentStatus: user.employmentStatus,
        },
        status: status,
        clockIn: att ? att.clockIn : null,
        clockOut: att ? att.clockOut : null,
        totalWorkMinutes,
        totalBreakMinutes,
        allowedBreakMinutes: allowedBreak,
        targetWorkMinutes: targetWork,
        isExcessBreak,
        excessBreakMinutes,
        isUnderWorkHours,
        underWorkMinutes,
        breakCount: att?.breaks?.length || 0,
        breaks: att?.breaks || [],
        shift: shift ? {
          _id: shift._id,
          name: shift.name,
          startTime: shift.startTime,
          endTime: shift.endTime,
          isNightShift: shift.isNightShift,
          color: shift.color,
          allowedBreakMinutes: shift.allowedBreakMinutes || 60,
          saturdayRule: shift.saturdayRule || 'flexible'
        } : null,
        attendance: att || null
      };
    });

    res.status(200).json(board);
  } catch (error) {
    console.error("Error getting today board:", error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const manualOverride = async (req, res) => {
  try {
    const { id } = req.params;
    const { clockIn, clockOut, notes } = req.body;
    
    const attendance = await Attendance.findById(id);
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    if (clockIn) attendance.clockIn = new Date(clockIn);
    if (clockOut) attendance.clockOut = new Date(clockOut);
    
    if (attendance.clockIn && attendance.clockOut) {
      const totalSessionMins = Math.round((attendance.clockOut - attendance.clockIn) / 60000);
      attendance.totalWorkMinutes = Math.max(0, totalSessionMins - (attendance.totalBreakMinutes || 0));
    }

    attendance.manualOverride = true;
    attendance.overrideNotes = notes || '';
    attendance.overrideBy = req.user.id;
    
    await attendance.save();
    
    res.status(200).json(attendance);
  } catch (error) {
    console.error("Error manual override:", error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const setSaturdayOverride = async (req, res) => {
  try {
    const { date, isWorking, note } = req.body;
    if (!date) {
      return res.status(400).json({ message: 'Date is required (YYYY-MM-DD)' });
    }

    let config = await AttendanceConfig.findOne();
    if (!config) {
      config = new AttendanceConfig();
    }

    const existingIndex = (config.workingSaturdayOverrides || []).findIndex(o => o.date === date);
    if (existingIndex > -1) {
      config.workingSaturdayOverrides[existingIndex].isWorking = isWorking;
      config.workingSaturdayOverrides[existingIndex].note = note || '';
      config.workingSaturdayOverrides[existingIndex].updatedBy = req.user.id;
    } else {
      config.workingSaturdayOverrides.push({
        date,
        isWorking,
        note: note || '',
        updatedBy: req.user.id
      });
    }

    await config.save();
    res.status(200).json({ message: 'Saturday schedule override saved', overrides: config.workingSaturdayOverrides });
  } catch (error) {
    console.error("Error setting Saturday override:", error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const deleteSaturdayOverride = async (req, res) => {
  try {
    const { date } = req.params;
    let config = await AttendanceConfig.findOne();
    if (!config) {
      return res.status(404).json({ message: 'Config not found' });
    }

    config.workingSaturdayOverrides = (config.workingSaturdayOverrides || []).filter(o => o.date !== date);
    await config.save();
    res.status(200).json({ message: 'Override removed', overrides: config.workingSaturdayOverrides });
  } catch (error) {
    console.error("Error deleting Saturday override:", error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
