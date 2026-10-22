import {PaymentError} from './payments.js';
import catalogAr from './catalog-ar.json' with {type:'json'};
export {catalogAr};
// Argentina (/argentina): prices in ARS are provisional and the bank integration is not connected yet,
// so the checkout shows the offer but no payment can be generated.
export async function createArPayment(){throw new PaymentError('El pago en Argentina todavía no está habilitado.',503)}
