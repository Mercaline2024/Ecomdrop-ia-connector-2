import { useState, useEffect } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // Obtener la configuración del Asistente IA
  const aiConfiguration = session?.shop
    ? await db.aIConfiguration.findUnique({
        where: { shop: session.shop }
      })
    : null;

  return { aiConfiguration };
};

// Tipos para los datos
interface PaymentMethod {
  id: string;
  name: string;
  enabled: boolean;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
}

interface Rule {
  id: string;
  text: string;
}

interface Notification {
  id: string;
  text: string;
}

export default function AIConfigurationPage() {
  const { aiConfiguration } = useLoaderData<typeof loader>();
  const shopify = useAppBridge();

  // Estados para los campos del formulario
  const [agentName, setAgentName] = useState(aiConfiguration?.agentName || "");
  const [companyName, setCompanyName] = useState(aiConfiguration?.companyName || "");
  const [companyDescription, setCompanyDescription] = useState(aiConfiguration?.companyDescription || "");
  const [companyPolicies, setCompanyPolicies] = useState(aiConfiguration?.companyPolicies || "");
  
  // Estados para arrays dinámicos
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(() => {
    if (aiConfiguration?.paymentMethods) {
      try {
        return JSON.parse(aiConfiguration.paymentMethods);
      } catch {
        return [];
      }
    }
    return [];
  });

  const [faq, setFaq] = useState<FAQ[]>(() => {
    if (aiConfiguration?.faq) {
      try {
        return JSON.parse(aiConfiguration.faq);
      } catch {
        return [];
      }
    }
    return [];
  });

  const [postSaleFaq, setPostSaleFaq] = useState<FAQ[]>(() => {
    if (aiConfiguration?.postSaleFaq) {
      try {
        return JSON.parse(aiConfiguration.postSaleFaq);
      } catch {
        return [];
      }
    }
    return [];
  });

  const [rules, setRules] = useState<Rule[]>(() => {
    if (aiConfiguration?.rules) {
      try {
        return JSON.parse(aiConfiguration.rules);
      } catch {
        return [];
      }
    }
    return [];
  });

  const [notifications, setNotifications] = useState<Notification[]>(() => {
    if (aiConfiguration?.notifications) {
      try {
        return JSON.parse(aiConfiguration.notifications);
      } catch {
        return [];
      }
    }
    return [];
  });

  // Funciones para agregar elementos
  const addPaymentMethod = () => {
    setPaymentMethods([
      ...paymentMethods,
      { id: Date.now().toString(), name: "", enabled: true }
    ]);
  };

  const removePaymentMethod = (id: string) => {
    setPaymentMethods(paymentMethods.filter(pm => pm.id !== id));
  };

  const updatePaymentMethod = (id: string, field: keyof PaymentMethod, value: any) => {
    setPaymentMethods(paymentMethods.map(pm => 
      pm.id === id ? { ...pm, [field]: value } : pm
    ));
  };

  const addFAQ = () => {
    setFaq([...faq, { id: Date.now().toString(), question: "", answer: "" }]);
  };

  const removeFAQ = (id: string) => {
    setFaq(faq.filter(f => f.id !== id));
  };

  const updateFAQ = (id: string, field: keyof FAQ, value: string) => {
    setFaq(faq.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  const addPostSaleFAQ = () => {
    setPostSaleFaq([...postSaleFaq, { id: Date.now().toString(), question: "", answer: "" }]);
  };

  const removePostSaleFAQ = (id: string) => {
    setPostSaleFaq(postSaleFaq.filter(f => f.id !== id));
  };

  const updatePostSaleFAQ = (id: string, field: keyof FAQ, value: string) => {
    setPostSaleFaq(postSaleFaq.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  const addRule = () => {
    setRules([...rules, { id: Date.now().toString(), text: "" }]);
  };

  const removeRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
  };

  const updateRule = (id: string, text: string) => {
    setRules(rules.map(r => r.id === id ? { ...r, text } : r));
  };

  const addNotification = () => {
    setNotifications([...notifications, { id: Date.now().toString(), text: "" }]);
  };

  const removeNotification = (id: string) => {
    setNotifications(notifications.filter(n => n.id !== id));
  };

  const updateNotification = (id: string, text: string) => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, text } : n));
  };

  // Manejar guardado (por ahora solo muestra que se guardará)
  const handleSave = async () => {
    // TODO: Implementar el endpoint cuando el usuario lo proporcione
    if (typeof window !== 'undefined') {
      shopify.toast.show("💾 Guardando configuración... (Endpoint pendiente)");
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '16px',
        padding: '2rem',
        marginBottom: '2rem',
        color: 'white',
        boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
      }}>
        <h1 style={{ fontSize: '2rem', margin: 0, marginBottom: '0.5rem' }}>
          🤖 Configurar Asistente IA
        </h1>
        <p style={{ fontSize: '1.1rem', opacity: 0.9, margin: 0 }}>
          Personaliza tu asistente de inteligencia artificial para brindar la mejor experiencia a tus clientes
        </p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
        {/* Información Básica */}
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: '1px solid #e1e3e5'
        }}>
          <h2 style={{ fontSize: '1.5rem', marginTop: 0, marginBottom: '1.5rem', color: '#333' }}>
            📋 Información Básica
          </h2>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#333' }}>
              👤 Nombre del agente IA
              <span style={{ color: '#999', fontSize: '0.875rem', marginLeft: '0.5rem' }}>ℹ️</span>
            </label>
            <input
              type="text"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="Ej: Andrés"
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid #ddd',
                fontSize: '1rem',
                fontFamily: 'inherit'
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#333' }}>
              🏢 Nombre de la empresa
              <span style={{ color: '#999', fontSize: '0.875rem', marginLeft: '0.5rem' }}>ℹ️</span>
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Ej: ClickShop®"
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid #ddd',
                fontSize: '1rem',
                fontFamily: 'inherit'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#333' }}>
              📝 Descripción de la empresa
              <span style={{ color: '#999', fontSize: '0.875rem', marginLeft: '0.5rem' }}>ℹ️</span>
            </label>
            <textarea
              value={companyDescription}
              onChange={(e) => setCompanyDescription(e.target.value)}
              placeholder="Describe tu empresa..."
              rows={4}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid #ddd',
                fontSize: '1rem',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
          </div>
        </div>

        {/* Métodos de Pago */}
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: '1px solid #e1e3e5'
        }}>
          <h2 style={{ fontSize: '1.5rem', marginTop: 0, marginBottom: '1.5rem', color: '#333' }}>
            💳 Métodos de pago
            <span style={{ color: '#999', fontSize: '0.875rem', marginLeft: '0.5rem' }}>ℹ️</span>
          </h2>

          {paymentMethods.length === 0 ? (
            <div style={{
              padding: '2rem',
              textAlign: 'center',
              background: '#f8f9fa',
              borderRadius: '8px',
              color: '#666'
            }}>
              No hay métodos de pago agregados
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {paymentMethods.map((pm) => (
                <div key={pm.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '1rem',
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  border: '1px solid #e1e3e5'
                }}>
                  <input
                    type="text"
                    value={pm.name}
                    onChange={(e) => updatePaymentMethod(pm.id, 'name', e.target.value)}
                    placeholder="Nombre del método de pago"
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #ddd',
                      fontSize: '1rem'
                    }}
                  />
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={pm.enabled}
                      onChange={(e) => updatePaymentMethod(pm.id, 'enabled', e.target.checked)}
                      style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                    />
                    <span style={{ color: '#666' }}>Activo</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => removePaymentMethod(pm.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#dc3545',
                      cursor: 'pointer',
                      padding: '0.5rem',
                      fontSize: '1.2rem'
                    }}
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={addPaymentMethod}
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginLeft: 'auto'
            }}
          >
            ➕ Agregar
          </button>
        </div>

        {/* Políticas de la empresa */}
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: '1px solid #e1e3e5'
        }}>
          <h2 style={{ fontSize: '1.5rem', marginTop: 0, marginBottom: '1.5rem', color: '#333' }}>
            📜 Políticas de la empresa
            <span style={{ color: '#999', fontSize: '0.875rem', marginLeft: '0.5rem' }}>ℹ️</span>
          </h2>
          <textarea
            value={companyPolicies}
            onChange={(e) => setCompanyPolicies(e.target.value)}
            placeholder="politicas de la empresa"
            rows={6}
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '8px',
              border: '1px solid #ddd',
              fontSize: '1rem',
              fontFamily: 'inherit',
              resize: 'vertical'
            }}
          />
        </div>

        {/* Preguntas Frecuentes */}
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: '1px solid #e1e3e5'
        }}>
          <h2 style={{ fontSize: '1.5rem', marginTop: 0, marginBottom: '1.5rem', color: '#333' }}>
            ❓ Preguntas Frecuentes
          </h2>

          {faq.length === 0 ? (
            <div style={{
              padding: '2rem',
              textAlign: 'center',
              background: '#f8f9fa',
              borderRadius: '8px',
              color: '#666'
            }}>
              No hay preguntas frecuentes agregadas
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {faq.map((item, index) => (
                <div key={item.id} style={{
                  padding: '1.5rem',
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  border: '1px solid #e1e3e5'
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '1rem', color: '#333' }}>
                    Pregunta #{index + 1}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <input
                      type="text"
                      value={item.question}
                      onChange={(e) => updateFAQ(item.id, 'question', e.target.value)}
                      placeholder="pregunta respuesta"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        borderRadius: '8px',
                        border: '1px solid #ddd',
                        fontSize: '1rem'
                      }}
                    />
                    <input
                      type="text"
                      value={item.answer}
                      onChange={(e) => updateFAQ(item.id, 'answer', e.target.value)}
                      placeholder="respuesta"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        borderRadius: '8px',
                        border: '1px solid #ddd',
                        fontSize: '1rem'
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFAQ(item.id)}
                    style={{
                      marginTop: '0.5rem',
                      background: 'none',
                      border: 'none',
                      color: '#dc3545',
                      cursor: 'pointer',
                      padding: '0.5rem',
                      fontSize: '1.2rem'
                    }}
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={addFAQ}
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginLeft: 'auto'
            }}
          >
            ➕ Agregar
          </button>
        </div>

        {/* Preguntas Frecuentes Post Venta */}
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: '1px solid #e1e3e5'
        }}>
          <h2 style={{ fontSize: '1.5rem', marginTop: 0, marginBottom: '1.5rem', color: '#333' }}>
            🛍️ Preguntas Frecuentes Post Venta
          </h2>

          {postSaleFaq.length === 0 ? (
            <div style={{
              padding: '2rem',
              textAlign: 'center',
              background: '#f8f9fa',
              borderRadius: '8px',
              color: '#666'
            }}>
              No hay preguntas post venta agregadas
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {postSaleFaq.map((item, index) => (
                <div key={item.id} style={{
                  padding: '1.5rem',
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  border: '1px solid #e1e3e5'
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '1rem', color: '#333' }}>
                    Pregunta #{index + 1}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <input
                      type="text"
                      value={item.question}
                      onChange={(e) => updatePostSaleFAQ(item.id, 'question', e.target.value)}
                      placeholder="pregunta post venta"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        borderRadius: '8px',
                        border: '1px solid #ddd',
                        fontSize: '1rem'
                      }}
                    />
                    <input
                      type="text"
                      value={item.answer}
                      onChange={(e) => updatePostSaleFAQ(item.id, 'answer', e.target.value)}
                      placeholder="respuesta post venta"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        borderRadius: '8px',
                        border: '1px solid #ddd',
                        fontSize: '1rem'
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removePostSaleFAQ(item.id)}
                    style={{
                      marginTop: '0.5rem',
                      background: 'none',
                      border: 'none',
                      color: '#dc3545',
                      cursor: 'pointer',
                      padding: '0.5rem',
                      fontSize: '1.2rem'
                    }}
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={addPostSaleFAQ}
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginLeft: 'auto'
            }}
          >
            ➕ Agregar
          </button>
        </div>

        {/* Reglas */}
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: '1px solid #e1e3e5'
        }}>
          <h2 style={{ fontSize: '1.5rem', marginTop: 0, marginBottom: '1.5rem', color: '#333' }}>
            📋 Reglas
          </h2>

          {rules.length === 0 ? (
            <div style={{
              padding: '2rem',
              textAlign: 'center',
              background: '#f8f9fa',
              borderRadius: '8px',
              color: '#666'
            }}>
              No hay reglas agregadas
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {rules.map((rule, index) => (
                <div key={rule.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '1rem',
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  border: '1px solid #e1e3e5'
                }}>
                  <div style={{ fontWeight: 'bold', color: '#333', minWidth: '80px' }}>
                    Regla #{index + 1}
                  </div>
                  <input
                    type="text"
                    value={rule.text}
                    onChange={(e) => updateRule(rule.id, e.target.value)}
                    placeholder="reglas"
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #ddd',
                      fontSize: '1rem'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => removeRule(rule.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#dc3545',
                      cursor: 'pointer',
                      padding: '0.5rem',
                      fontSize: '1.2rem'
                    }}
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={addRule}
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginLeft: 'auto'
            }}
          >
            ➕ Agregar
          </button>
        </div>

        {/* Notificaciones */}
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: '1px solid #e1e3e5'
        }}>
          <h2 style={{ fontSize: '1.5rem', marginTop: 0, marginBottom: '1.5rem', color: '#333' }}>
            🔔 Notificaciones
            <span style={{ color: '#999', fontSize: '0.875rem', marginLeft: '0.5rem' }}>ℹ️</span>
          </h2>

          {notifications.length === 0 ? (
            <div style={{
              padding: '1rem',
              background: '#f8f9fa',
              borderRadius: '8px',
              color: '#666',
              marginBottom: '1rem'
            }}>
              No hay notificaciones agregadas
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
              {notifications.map((notification) => (
                <div key={notification.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '1rem',
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  border: '1px solid #e1e3e5'
                }}>
                  <input
                    type="text"
                    value={notification.text}
                    onChange={(e) => updateNotification(notification.id, e.target.value)}
                    placeholder="Notificación"
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #ddd',
                      fontSize: '1rem'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => removeNotification(notification.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#dc3545',
                      cursor: 'pointer',
                      padding: '0.5rem',
                      fontSize: '1.2rem'
                    }}
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={addNotification}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginLeft: 'auto'
            }}
          >
            ➕ Agregar
          </button>
        </div>

        {/* Botón Guardar */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          paddingTop: '2rem',
          borderTop: '1px solid #e1e3e5',
          marginTop: '2rem'
        }}>
          <button
            type="submit"
            style={{
              padding: '1rem 2rem',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1.1rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
            }}
          >
            💾 Guardar
          </button>
        </div>
      </form>
    </div>
  );
}

