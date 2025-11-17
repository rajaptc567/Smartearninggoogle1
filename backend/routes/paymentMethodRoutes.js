
import express from 'express';
import {
    getPaymentMethods,
    createPaymentMethod,
    updatePaymentMethod,
    deletePaymentMethod
} from '../controllers/paymentMethodsController.js';

const router = express.Router();

router.route('/')
    .get(getPaymentMethods)
    .post(createPaymentMethod);

router.route('/:id')
    .put(updatePaymentMethod)
    .delete(deletePaymentMethod);

export default router;
