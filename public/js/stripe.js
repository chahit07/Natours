import axios from 'axios';
import { showAlert } from './alerts';
const stripe = Stripe(
  'pk_test_51RCFpbC855XuR1MdFbssCcMcX2bTM8Sjp3FZUbKLzRqnbm0HPqAOAK6zESYLpBA8rKvl3hCmoohk11flIvLk1nci00jREWSR7Z'
);

export const bookTour = async (tourId) => {
  try {
    // 1) Get checkout session from API
    const session = await axios(`/api/v1/bookings/checkout-session/${tourId}`);

    // 2) Create checkout form + charge credit card
    const checkoutPageUrl = session.data.session.url;
    window.location.assign(checkoutPageUrl);
  } catch (error) {
    showAlert('error', error);
  }
};
