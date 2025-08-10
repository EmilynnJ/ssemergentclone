import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { useAuth } from '@clerk/clerk-react';

/**
 * ShopPage
 *
 * Displays all marketplace products and enables users to purchase
 * digital or physical items using Stripe payment. Each product card
 * contains a purchase form allowing the user to specify quantity and
 * proceed with a secure payment. After purchasing, the form resets.
 */
const ShopPage = () => {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [clientSecret, setClientSecret] = useState(null);
  const stripe = useStripe();
  const elements = useElements();
  const { getToken } = useAuth();

  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await axios.get('/api/products');
        setProducts(res.data);
      } catch (err) {
        console.error('Failed to fetch products', err);
      }
    }
    fetchProducts();
  }, []);

  const startPurchase = async (product) => {
    setSelectedProduct(product);
    setQuantity(1);
    setClientSecret(null);
  };

  const createOrder = async () => {
    try {
      const token = await getToken();
      const res = await axios.post('/api/orders', { productId: selectedProduct.id, quantity }, { headers: { Authorization: `Bearer ${token}` } });
      setClientSecret(res.data.clientSecret);
    } catch (err) {
      console.error('Failed to create order', err);
    }
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    try {
      const result = await stripe.confirmPayment({ elements, confirmParams: {} });
      if (result.error) {
        console.error(result.error.message);
      } else {
        alert('Payment successful! Thank you for your purchase.');
        setSelectedProduct(null);
        setClientSecret(null);
      }
    } catch (err) {
      console.error('Error confirming payment', err);
    }
  };

  return (
    <div className="p-6 text-white">
      <h2 className="font-alex-brush text-5xl text-soul-pink mb-4 text-center">Shop</h2>
      {selectedProduct ? (
        <div className="max-w-md mx-auto bg-soul-black bg-opacity-70 backdrop-blur-md p-6 rounded-lg shadow-lg">
          <h3 className="font-playfair text-2xl mb-2">Purchase {selectedProduct.name}</h3>
          <p className="mb-2">Price: ${selectedProduct.price.toFixed(2)}</p>
          <label className="block mb-2">
            Quantity:
            <input type="number" value={quantity} min="1" onChange={(e) => setQuantity(parseInt(e.target.value, 10))} className="ml-2 p-1 text-soul-black rounded" />
          </label>
          {!clientSecret && (
            <button onClick={createOrder} className="bg-soul-pink hover:bg-soul-pink-light text-soul-black px-4 py-2 rounded">Proceed to Payment</button>
          )}
          {clientSecret && (
            <form onSubmit={handlePaymentSubmit} className="mt-4 space-y-2">
              <PaymentElement options={{ clientSecret }} />
              <button type="submit" className="bg-soul-pink hover:bg-soul-pink-light text-soul-black px-4 py-2 rounded w-full">Confirm Payment</button>
            </form>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((prod) => (
            <div key={prod.id} className="bg-soul-black bg-opacity-70 backdrop-blur-md p-4 rounded-lg shadow-lg flex flex-col justify-between">
              <img src={prod.image_url} alt={prod.name} className="w-full h-40 object-cover rounded" />
              <div className="mt-2">
                <h3 className="font-playfair text-xl mb-1">{prod.name}</h3>
                <p className="text-sm mb-2">${prod.price.toFixed(2)}</p>
              </div>
              <button onClick={() => startPurchase(prod)} className="mt-auto bg-soul-pink hover:bg-soul-pink-light text-soul-black px-4 py-2 rounded">Buy</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ShopPage;