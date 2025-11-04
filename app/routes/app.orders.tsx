import { useEffect, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function OrdersPage() {
  const fetcher = useFetcher();
  const [orders, setOrders] = useState<any[]>([]);
  const [isPolling, setIsPolling] = useState(false);

  const fetchOrders = () => {
    fetcher.load('/api/orders/poll');
  };

  useEffect(() => {
    // Cargar órdenes iniciales
    fetchOrders();
  }, []);

  useEffect(() => {
    if (fetcher.data?.success) {
      setOrders(fetcher.data.orders);
    }
  }, [fetcher.data]);

  // Polling automático cada 30 segundos si está activo
  useEffect(() => {
    if (!isPolling) return;

    const interval = setInterval(() => {
      fetchOrders();
    }, 30000);

    return () => clearInterval(interval);
  }, [isPolling]);

  const togglePolling = () => {
    setIsPolling(!isPolling);
    if (!isPolling) {
      fetchOrders();
    }
  };

  return (
    <s-page heading="Orders Manager">
      <s-button 
        slot="primary-action" 
        onClick={togglePolling}
        {...(isPolling ? { variant: "critical" } : {})}
      >
        {isPolling ? "⏸ Stop Polling" : "▶ Start Polling"}
      </s-button>

      <s-section heading="Recent Orders">
        <s-paragraph>
          {isPolling 
            ? "Polling every 30 seconds for new orders..." 
            : "Manual polling. Click 'Start Polling' for automatic updates."}
        </s-paragraph>

        <s-button 
          onClick={fetchOrders} 
          variant="secondary"
          {...(fetcher.state === 'loading' ? { loading: true } : {})}
        >
          🔄 Refresh Now
        </s-button>
      </s-section>

      {orders.length > 0 ? (
        <s-section heading={`Found ${orders.length} orders`}>
          <s-stack direction="block" gap="base">
            {orders.map((order: any) => (
              <s-box
                key={order.id}
                padding="base"
                borderWidth="base"
                borderRadius="base"
                background="subdued"
              >
                <s-stack direction="block" gap="base">
                  <div>
                    <s-heading size="small">{order.name}</s-heading>
                    <s-text tone="subdued">
                      Created: {new Date(order.createdAt).toLocaleString()}
                    </s-text>
                  </div>

                  <div>
                    <strong>Status:</strong> {order.financialStatus} / {order.fulfillmentStatus}
                  </div>

                  <div>
                    <strong>Total:</strong> {order.currency} {order.totalPrice}
                  </div>

                  <div>
                    <strong>Items:</strong>
                    <ul>
                      {order.lineItems.map((item: any, idx: number) => (
                        <li key={idx}>
                          {item.quantity}x {item.name} {item.sku && `(${item.sku})`}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {order.customer && (
                    <div>
                      <strong>Customer:</strong> {order.customer.email || 'Guest'}
                    </div>
                  )}

                  {order.shippingAddress && (
                    <div>
                      <strong>Shipping to:</strong> {order.shippingAddress.city}, {order.shippingAddress.country}
                    </div>
                  )}

                  {order.tags && order.tags.length > 0 && (
                    <div>
                      <strong>Tags:</strong> {order.tags.join(', ')}
                    </div>
                  )}
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        </s-section>
      ) : (
        <s-section heading="No orders found">
          <s-paragraph>
            No recent orders. Create a test order in your Shopify admin to see it here.
          </s-paragraph>
        </s-section>
      )}
    </s-page>
  );
}

