const User = require('../models/User');

class AuthService {
  async register(userData) {
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      throw new Error('Bu email artıq istifadə olunub');
    }

    const user = await User.create(userData);
    const token = user.getSignedJwtToken();

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

  async login(email, password) {
    const user = await User.findOne({ email }).select('+password');

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

    user.lastLogin = new Date();
    await user.save();

    const token = user.getSignedJwtToken();

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
