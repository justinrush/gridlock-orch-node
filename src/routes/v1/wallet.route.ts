import express, { Router } from 'express';
import { validate } from '../../modules/validate';
import { walletController, walletValidation } from '../../modules/wallet';
import { auth } from '../../modules/auth';

const router: Router = express.Router();

router
  .route('/')
  .post(auth(), validate(walletValidation.createWallet), walletController.createWallet)
  .get(auth(), validate(walletValidation.getWallets), walletController.getWallets);

router.route('/sign').post(auth(), validate(walletValidation.signTransaction), walletController.sign);
router.route('/verify').post(auth(), validate(walletValidation.verify), walletController.verify);
router.route('/paillier').post(auth(), validate(walletValidation.checkPaillier), walletController.paillierForWallet);

router
  .route('/:walletId')
  .get(auth(), validate(walletValidation.getWallet), walletController.getWallet)
  .patch(auth(), validate(walletValidation.updateWallet), walletController.updateWallet)
  .delete(auth(), validate(walletValidation.deleteWallet), walletController.deleteWallet);

router.route('/recover').post(validate(walletValidation.keyshareRecovery), walletController.keyshareRecovery);

export default router;
