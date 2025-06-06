const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const crypto = require('crypto');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Email = require('../utils/email');

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode, req, res) => {
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
  };

  // if (req.secure || req.headers['x-forwarded-proto'] === 'https') cookieOptions.secure = true;

  res.cookie('jwt', token, cookieOptions);

  // res.cookie('jwt', token, {
  //   expires: new Date(
  //     Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
  //   ),
  //   httpOnly: true,
  //   secure: req.secure || req.headers('x-forwarded-proto') === 'https',
  // });

  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

/**
 * @description - Create New User
 * @route - POST /api/v1/users/signup
 */
exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
  });

  // Send welcome email in the background
  sendWelcomeEmail(newUser, req);

  createSendToken(newUser, 201, req, res);
});

const sendWelcomeEmail = async (newUser, req) => {
  try {
    // Send welcome email to new user
    const url = `${req.protocol}://${req.get('host')}/me`;
    await new Email(newUser, url).sendWelcome();
  } catch (error) {
    console.log('Error sending welcome email:', error);
  }
};

/**
 * @description - Login User
 * @route - POST /api/v1/users/login
 */
exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1) Check if user provide email and password
  if (!email || !password) {
    return next(new AppError('Please provide email and password!', 400));
  }

  // 2) Check if user exists && password is correct
  const user = await User.findOne({ email }).select('+password');

  /**
   * 3) Check if user not exists or password is incorrect
   * "correctPassword" our own custom document instance methods from "userModel.js" which returns boolean
   */
  if (!user || !(await user.comparePassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401));
  }

  // 4) If everything ok, send token to client
  createSendToken(user, 200, req, res);
});

// Log out user by passing dummy token instead and expires in 10 seconds
exports.logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json({ status: 'success' });
};

/**
 * Middleware function to check if the user is authenticated
 * @description - Only login user can access tour routes
 */
exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token, and check if it's there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(new AppError('Please login to get access!', 401));
  }

  // 2) Verification token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id);

  if (!currentUser) {
    return next(
      new AppError('The user associated with this token no longer exists.', 401)
    );
  }

  /**
   * 4) Check if user changed password after the token was issued
   * "changedPasswordAfter" is document instance methods from "userModel.js" which returns boolean
   */
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError('User recently changed password! Please log in again.', 401)
    );
  }

  // GRANT ACCESS TO PROTECTED ROUTE
  req.user = currentUser;
  res.locals.user = currentUser;
  next();
});

// Only for rendered pages, no errors!
exports.isLoggedIn = async (req, res, next) => {
  if (req.cookies.jwt) {
    try {
      // 1) Verify token
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET
      );

      // 2) Check if user still exists
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return next();
      }

      /**
       * 3) Check if user changed password after the token was issued
       * "changedPasswordAfter" is document instance methods from "userModel.js" which returns boolean
       */
      if (currentUser.changedPasswordAfter(decoded.iat)) {
        return next();
      }

      // THERE IS A LOGGED IN USER
      res.locals.user = currentUser; // Here "res.locals" can be accessed by pug templates
      return next();
    } catch (error) {
      return next();
    }
  }
  next();
};

/**
 * Middleware function to check user's role
 * @description - It will restrict to other roles to perform next action
 */
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // roles = ['admin', 'lead-guide'] and if role = 'user'
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError("You don't have permission to perform this action.", 403)
      );
    }

    next();
  };
};

/**
 * @description - Forgot Password
 * @route - POST /api/v1/users/forgotPassword
 */
exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on posted email
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return next(new AppError('There is no user with this email address.', 403));
  }

  // 2) Generate the random reset token for the user
  // "generatePasswordResetToken" is document instance methods from "userModel"
  const resetToken = user.generatePasswordResetToken(); // without encrypted/simple token
  await user.save({ validateBeforeSave: false });

  // 3) Send it to user's email
  const resetURL = `${req.protocol}://${req.get(
    'host'
  )}/api/v1/users/resetPassword/${resetToken}`; // e.g. http://127.0.0.1:8000/api/v1/users/resetPassword/2342342

  try {
    // Send password reset email to requested user
    const email = new Email(user, resetURL);

    await email.sendWelcome();
    // await new Email(user, resetURL).sendPasswordReset();
    console.log("*********************email********************");
    res.status(200).json({
      status: 'success',
      message: 'Token sent to email!',
    });
  } catch (error) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    console.log(error);
    
    return next(
      new AppError(
        'There was an error sending the email. Try again later!',
        500
      )
    );
  }

  // try {
  //   // Send password reset email to requested user
  //   await new Email(user, resetURL).sendPasswordReset();
  //   console.log("*********************email********************");
  //   res.status(200).json({
  //     status: 'success',
  //     message: 'Token sent to email!',
  //   });
  // } catch (error) {
  //   user.passwordResetToken = undefined;
  //   user.passwordResetExpires = undefined;
  //   await user.save({ validateBeforeSave: false });

  //   return next(
  //     new AppError(
  //       'There was an error sending the email. Try again later!',
  //       500
  //     )
  //   );
  // }
});

/**
 * @description - Reset Password
 * @route - PATCH /api/v1/users/resetPassword/:token
 */
exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token (encrypt this simple token and then compare with the stored token)
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }, // should be greater than the "resetPassword" opening time
  });

  // 2) If token has not expired, and there is user, set the new password
  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400));
  }

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  // 3) Update changedPasswordAt property for the user
  // 4) Log the user in, send JWT
  createSendToken(user, 200, req, res);
});

/**
 * @description - Update Current User Password
 * @route - PATCH /api/v1/users/updateMyPassword
 */
exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection
  const user = await User.findById(req.user.id).select('+password');

  // 2) Check if POSTed current password is correct
  if (!(await user.comparePassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Current password is incorrect.', 401));
  }

  // 3) If so, update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();

  // 4) Log user in, send JWT
  createSendToken(user, 200, req, res);
});
