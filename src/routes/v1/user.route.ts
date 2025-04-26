import express, { Router } from 'express';
import { validate } from '../../modules/validate';
import { auth } from '../../modules/auth';
import { userController, userValidation } from '../../modules/user';

const router: Router = express.Router();

router
  .route('/')
  .post(auth(), validate(userValidation.createUser), userController.createUser)
  .get(auth(), validate(userValidation.getUsers), userController.getUsers);

router
  .route('/addGuardian/custom')
  .post(auth(), validate(userValidation.addCustomGuardian), userController.addCustomGuardian);

router
  .route('/addGuardian/gridlock')
  .post(auth(), validate(userValidation.addGridlockGuardian), userController.addGridlockGuardian);

router
  .route('/addGuardian/partner')
  .post(auth(), validate(userValidation.addPartnerGuardian), userController.addPartnerGuardian);

router.route('/recovery').post(validate(userValidation.recoverUser), userController.recoverUser);

router.route('/recovery/confirm').post(validate(userValidation.confirmRecovery), userController.confirmRecoverUser);

router.route('/transfer').post(validate(userValidation.transferUser), userController.transferUser);

router
  .route('/:email')
  .get(validate(userValidation.getUser), userController.getUser)
  .patch(auth(), validate(userValidation.updateUser), userController.updateUser)
  .delete(auth(), validate(userValidation.deleteUser), userController.deleteUser);

export default router;
