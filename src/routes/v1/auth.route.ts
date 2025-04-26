import express, { Router } from 'express';
import { validate } from '../../modules/validate';
import { authValidation, authController, auth } from '../../modules/auth';

const router: Router = express.Router();

router.post('/register', validate(authValidation.register), authController.register);
router.post('/login', validate(authValidation.login), authController.login);
router.post('/loginChallenge', validate(authValidation.loginChallenge), authController.loginChallenge);
router.post('/logout', validate(authValidation.logout), authController.logout);
router.post('/refresh-tokens', validate(authValidation.refreshTokens), authController.refreshTokens);
router.post('/send-verification-email', auth(), authController.sendVerificationEmail);
router.post('/verify-email', validate(authValidation.verifyEmail), authController.verifyEmail);
router.post('/nonce', validate(authValidation.nonce), authController.getNonce);

export default router;
