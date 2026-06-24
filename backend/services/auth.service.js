const User = require('../models/User');
const Branch = require('../models/Branch');

class AuthService {
  async getUsers() {
    return User.find({}, '-password')
      .populate('branchId', 'name code')
      .sort({ role: 1, name: 1 })
      .lean();
  }

  async updateUser(id, data) {
    const allowed = ['name', 'phone', 'role', 'branchId', 'ownerId', 'isActive'];
    const update = {};
    allowed.forEach((k) => { if (data[k] !== undefined) update[k] = data[k]; });
    const user = await User.findByIdAndUpdate(id, update, { new: true, runValidators: true })
      .populate('branchId', 'name code')
      .select('-password');
    if (!user) throw new Error('İstifadəçi tapılmadı');
    return user;
  }

  async resetPassword(id, newPassword) {
    if (!newPassword || newPassword.length < 6) throw new Error('Şifrə minimum 6 simvol olmalıdır');
    const user = await User.findById(id).select('+password');
    if (!user) throw new Error('İstifadəçi tapılmadı');
    user.password = newPassword;
    await user.save();
    return { message: 'Şifrə yeniləndi' };
  }

  async deleteUser(id, requestingUserId) {
    if (String(id) === String(requestingUserId)) throw new Error('Öz hesabınızı silə bilməzsiniz');
    const user = await User.findById(id);
    if (!user) throw new Error('İstifadəçi tapılmadı');
    user.isActive = false;
    await user.save();
    return { message: 'İstifadəçi deaktiv edildi' };
  }

  async register(userData) {
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      throw new Error('Bu email artıq istifadə olunub');
    }

    const user = await User.create(userData);

    // No token is issued here: register is a director-only provisioning action
    // (the caller is already the authenticated SUPER_OWNER, not the new user).
    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        ownerId: user.ownerId,
        branchId: user.branchId
      }
    };
  }

  // Login-page autocomplete: return active users whose email/name starts with the
  // typed prefix, so a salesperson can type a few letters and pick their account.
  async searchUsernames(q) {
    const term = String(q || '').trim();
    if (term.length < 2) return [];
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp('^' + escaped, 'i');
    return User.find({ isActive: true, $or: [{ email: rx }, { name: rx }] })
      .select('name email -_id')
      .sort({ email: 1 })
      .limit(8)
      .lean();
  }

  async login(email, password) {
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user) {
      throw new Error('Email və ya şifrə yanlışdır');
    }

    if (!user.isActive) {
      throw new Error('Hesabınız deaktiv edilib');
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      throw new Error('Email və ya şifrə yanlışdır');
    }

    const token = user.getSignedJwtToken();

    // Update lastLogin in background (don't block login response)
    User.updateOne({ _id: user._id }, { lastLogin: new Date() }).catch(() => {});

    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        ownerId: user.ownerId,
        branchId: user.branchId
      },
      token
    };
  }

  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId).select('+password');

    if (!user) {
      throw new Error('İstifadəçi tapılmadı');
    }

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      throw new Error('Cari şifrə yanlışdır');
    }

    user.password = newPassword;
    await user.save();

    return { message: 'Şifrə uğurla dəyişdirildi' };
  }

  async getProfile(userId) {
    const user = await User.findById(userId)
      .populate('branchId', 'name code')
      .select('-password');

    if (!user) {
      throw new Error('İstifadəçi tapılmadı');
    }

    return user;
  }
}

module.exports = new AuthService();
