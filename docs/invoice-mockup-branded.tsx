import React, { useState } from 'react';
import { 
  Upload, 
  CheckCircle, 
  BarChart3, 
  Building2, 
  Users, 
  Code, 
  Download,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Edit,
  Trash2,
  Plus,
  Play,
  Check,
  X
} from 'lucide-react';

const styles = {
  app: {
    display: 'flex',
    height: '100vh',
    fontFamily: "'Inter', 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif",
    backgroundColor: '#F8F9FA',
    backgroundImage: 'linear-gradient(135deg, rgba(27, 75, 140, 0.02) 0%, rgba(46, 124, 228, 0.02) 100%)'
  },
  header: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: '64px',
    background: 'linear-gradient(135deg, #1B4B8C, #2E7CE4)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    padding: '0 24px',
    zIndex: 1000,
    boxShadow: '0 4px 20px rgba(27, 75, 140, 0.3)'
  },
  sidebar: {
    width: '240px',
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(20px)',
    borderRight: '1px solid rgba(27, 75, 140, 0.1)',
    marginTop: '64px',
    height: 'calc(100vh - 64px)',
    overflowY: 'auto'
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 20px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    borderLeft: '3px solid transparent',
    color: '#2C3E50'
  },
  menuItemActive: {
    background: 'rgba(46, 124, 228, 0.1)',
    borderLeftColor: '#2E7CE4',
    fontWeight: 600,
    color: '#1B4B8C'
  },
  content: {
    flex: 1,
    marginTop: '64px',
    overflowY: 'auto',
    padding: '24px'
  },
  glassCard: {
    background: 'rgba(255, 255, 255, 0.8)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(27, 75, 140, 0.1)',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '24px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '16px'
  },
  th: {
    textAlign: 'left',
    padding: '12px',
    borderBottom: '2px solid rgba(27, 75, 140, 0.2)',
    fontWeight: 600,
    color: '#1B4B8C',
    fontSize: '14px'
  },
  td: {
    padding: '12px',
    borderBottom: '1px solid rgba(27, 75, 140, 0.1)',
    color: '#2C3E50'
  },
  button: {
    padding: '12px 24px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'all 0.3s ease',
    fontFamily: 'inherit'
  },
  buttonPrimary: {
    background: 'linear-gradient(135deg, #1B4B8C, #2E7CE4)',
    color: 'white',
    boxShadow: '0 4px 15px rgba(27, 75, 140, 0.3)'
  },
  buttonGlass: {
    background: 'rgba(255, 255, 255, 0.8)',
    backdropFilter: 'blur(15px)',
    border: '1px solid rgba(27, 75, 140, 0.2)',
    color: '#1B4B8C'
  },
  buttonSuccess: {
    background: '#28A745',
    color: 'white',
    boxShadow: '0 4px 15px rgba(40, 167, 69, 0.3)'
  },
  buttonDanger: {
    background: '#FD7E14',
    color: 'white',
    boxShadow: '0 4px 15px rgba(253, 126, 20, 0.3)'
  },
  chip: {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: '16px',
    fontSize: '12px',
    fontWeight: 500
  },
  chipSuccess: {
    background: 'rgba(40, 167, 69, 0.15)',
    color: '#28A745',
    border: '1px solid rgba(40, 167, 69, 0.3)'
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    border: '1px solid rgba(27, 75, 140, 0.2)',
    borderRadius: '8px',
    fontSize: '14px',
    boxSizing: 'border-box',
    background: 'rgba(255, 255, 255, 0.8)',
    backdropFilter: 'blur(10px)',
    color: '#2C3E50',
    fontFamily: 'inherit'
  },
  select: {
    width: '100%',
    padding: '12px 16px',
    border: '1px solid rgba(27, 75, 140, 0.2)',
    borderRadius: '8px',
    fontSize: '14px',
    background: 'rgba(255, 255, 255, 0.8)',
    cursor: 'pointer',
    color: '#2C3E50',
    fontFamily: 'inherit'
  },
  alertSuccess: {
    background: 'rgba(40, 167, 69, 0.15)',
    border: '1px solid rgba(40, 167, 69, 0.3)',
    color: '#28A745',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: 500
  },
  alertInfo: {
    background: 'rgba(46, 124, 228, 0.15)',
    border: '1px solid rgba(46, 124, 228, 0.3)',
    color: '#2E7CE4',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '16px',
    fontSize: '14px'
  }
};

const ImportScreen = () => {
  const [vendor, setVendor] = useState('');
  
  return (
    <div>
      <h1 style={{ marginTop: 0, marginBottom: '24px', color: '#1B4B8C', fontWeight: 600 }}>Import Invoices</h1>
      
      <div style={styles.glassCard}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: '#2C3E50' }}>
              Select Vendor
            </label>
            <select 
              style={styles.select}
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
            >
              <option value="">Choose vendor...</option>
              <option value="genesys">Genesys</option>
              <option value="five9">Five9</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: '#2C3E50' }}>
              Folder Path
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                style={styles.input}
                placeholder="C:\Invoices\Five9\..."
              />
              <button style={{...styles.button, ...styles.buttonGlass}}>
                Browse
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={styles.glassCard}>
        <h3 style={{ marginTop: 0, color: '#1B4B8C', fontWeight: 600 }}>Files Detected (3)</h3>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{...styles.th, width: '40px'}}>
                <input type="checkbox" defaultChecked />
              </th>
              <th style={styles.th}>Filename</th>
              <th style={styles.th}>Type</th>
              <th style={styles.th}>Size</th>
            </tr>
          </thead>
          <tbody>
            {[
              { name: 'INV01208704.html', type: 'HTML', size: '145 KB' },
              { name: 'INV01208705.html', type: 'HTML', size: '138 KB' },
              { name: 'INV01208706.pdf', type: 'PDF', size: '245 KB' }
            ].map((file, idx) => (
              <tr key={idx}>
                <td style={styles.td}>
                  <input type="checkbox" defaultChecked />
                </td>
                <td style={styles.td}>{file.name}</td>
                <td style={styles.td}>
                  <span style={{...styles.chip, ...styles.chipSuccess}}>{file.type}</span>
                </td>
                <td style={styles.td}>{file.size}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button 
        style={{...styles.button, ...styles.buttonPrimary, display: 'flex', alignItems: 'center', gap: '8px'}}
        disabled={!vendor}
      >
        <Play size={16} />
        Start Processing
      </button>
    </div>
  );
};

const ReviewScreen = () => {
  const mockInvoice = {
    invoice_number: "INV01208704",
    customer_name: "Christian Healthcare Ministries",
    invoice_date: "2024-10-01",
    due_date: "2024-10-31",
    amount_due: 47646.21,
    total_recurring: 44249.06,
    total_one_time: 2.50,
    total_usage: 378.00,
    total_taxes: 3012.76
  };

  const lineItems = [
    { line: 1, desc: "Caller ID Display (CNAM) Activation", qty: 1, amount: 2.67 },
    { line: 2, desc: "Five9 Core - Voice Contact Center", qty: 150, amount: 9927.75 },
    { line: 3, desc: "Five9 Enterprise QM Usage", qty: 21, amount: 403.52 }
  ];

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 112px)', gap: '16px' }}>
      <div style={{ width: '60%', ...styles.glassCard, marginBottom: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button style={{...styles.button, ...styles.buttonGlass, padding: '8px 12px'}}>
              <ChevronLeft size={20} />
            </button>
            <span style={{ fontWeight: 500, color: '#2C3E50' }}>Invoice 1 of 3</span>
            <button style={{...styles.button, ...styles.buttonGlass, padding: '8px 12px'}}>
              <ChevronRight size={20} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={{...styles.button, ...styles.buttonGlass, padding: '8px 12px'}}>
              <ZoomOut size={20} />
            </button>
            <button style={{...styles.button, ...styles.buttonGlass, padding: '8px 12px'}}>
              <ZoomIn size={20} />
            </button>
          </div>
        </div>
        
        <div style={{ background: 'rgba(248, 249, 250, 0.5)', padding: '24px', borderRadius: '8px', minHeight: '500px', border: '1px solid rgba(27, 75, 140, 0.1)' }}>
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <h2 style={{ marginTop: 0, color: '#1B4B8C', fontWeight: 600 }}>Five9 Invoice</h2>
            <p style={{ color: '#2C3E50' }}><strong>Invoice #:</strong> INV01208704</p>
            <p style={{ color: '#2C3E50' }}><strong>Date:</strong> 10/01/2024</p>
            <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid rgba(27, 75, 140, 0.1)' }} />
            <p style={{ color: '#2C3E50' }}><strong>Customer:</strong> Christian Healthcare Ministries</p>
            <p style={{ color: '#2C3E50' }}><strong>Amount Due:</strong> $47,646.21</p>
          </div>
        </div>
      </div>

      <div style={{ width: '40%', overflowY: 'auto' }}>
        <div style={styles.alertSuccess}>
          <CheckCircle size={20} />
          <span>Confidence Score: 95%</span>
        </div>

        <div style={styles.glassCard}>
          <h3 style={{ marginTop: 0, color: '#1B4B8C', fontWeight: 600 }}>Invoice Header</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {Object.entries(mockInvoice).map(([key, value]) => (
                <tr key={key}>
                  <td style={{ padding: '8px 0', fontWeight: 500, width: '40%', color: '#2C3E50' }}>
                    {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </td>
                  <td style={{ padding: '8px 0' }}>
                    <input 
                      style={{...styles.input, padding: '6px 12px'}}
                      value={typeof value === 'number' ? value.toFixed(2) : value}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={styles.glassCard}>
          <h3 style={{ marginTop: 0, color: '#1B4B8C', fontWeight: 600 }}>Line Items (3)</h3>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>#</th>
                <th style={styles.th}>Description</th>
                <th style={styles.th}>Qty</th>
                <th style={styles.th}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item) => (
                <tr key={item.line}>
                  <td style={styles.td}>{item.line}</td>
                  <td style={styles.td}>{item.desc}</td>
                  <td style={styles.td}>{item.qty}</td>
                  <td style={styles.td}>${item.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button style={{...styles.button, ...styles.buttonGlass, marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px'}}>
            <Plus size={16} />
            Add Row
          </button>
        </div>

        <div style={{...styles.glassCard, background: 'rgba(248, 249, 250, 0.95)'}}>
          <h3 style={{ marginTop: 0, color: '#1B4B8C', fontWeight: 600 }}>Totals</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#2C3E50' }}>
            <span>Recurring:</span>
            <strong>${mockInvoice.total_recurring.toFixed(2)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#2C3E50' }}>
            <span>One-Time:</span>
            <strong>${mockInvoice.total_one_time.toFixed(2)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#2C3E50' }}>
            <span>Usage:</span>
            <strong>${mockInvoice.total_usage.toFixed(2)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', color: '#2C3E50' }}>
            <span>Taxes:</span>
            <strong>${mockInvoice.total_taxes.toFixed(2)}</strong>
          </div>
          <hr style={{ margin: '16px 0', border: 'none', borderTop: '2px solid rgba(27, 75, 140, 0.2)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#1B4B8C' }}>
            <h3 style={{ margin: 0, fontWeight: 600 }}>Total:</h3>
            <h3 style={{ margin: 0, fontWeight: 600 }}>${mockInvoice.amount_due.toFixed(2)}</h3>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button style={{...styles.button, ...styles.buttonSuccess, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}}>
            <Check size={16} />
            Approve
          </button>
          <button style={{...styles.button, ...styles.buttonDanger, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}}>
            <X size={16} />
            Reject
          </button>
        </div>
      </div>
    </div>
  );
};

const VendorsScreen = () => {
  const vendors = [
    { id: 1, name: "Genesys", active: true, invoices: 145 },
    { id: 2, name: "Five9", active: true, invoices: 89 }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', alignItems: 'center' }}>
        <h1 style={{ margin: 0, color: '#1B4B8C', fontWeight: 600 }}>Vendors</h1>
        <button style={{...styles.button, ...styles.buttonPrimary, display: 'flex', alignItems: 'center', gap: '8px'}}>
          <Plus size={16} />
          Add Vendor
        </button>
      </div>

      <div style={styles.glassCard}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Vendor Name</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Invoices Processed</th>
              <th style={styles.th}>Active Prompt</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((vendor) => (
              <tr key={vendor.id}>
                <td style={styles.td}>{vendor.name}</td>
                <td style={styles.td}>
                  <span style={{...styles.chip, ...styles.chipSuccess}}>Active</span>
                </td>
                <td style={styles.td}>{vendor.invoices}</td>
                <td style={styles.td}>Default Prompt</td>
                <td style={styles.td}>
                  <button style={{...styles.button, ...styles.buttonGlass, padding: '6px 10px', marginRight: '8px'}}>
                    <Edit size={16} />
                  </button>
                  <button style={{...styles.button, ...styles.buttonGlass, padding: '6px 10px', marginRight: '8px'}}>
                    <Code size={16} />
                  </button>
                  <button style={{...styles.button, ...styles.buttonGlass, padding: '6px 10px'}}>
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const PromptsScreen = () => {
  const [selected, setSelected] = useState(1);
  const prompts = [
    { id: 1, vendor: "Genesys", name: "Default Prompt", version: 3 },
    { id: 2, vendor: "Five9", name: "Default Prompt", version: 2 }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', alignItems: 'center' }}>
        <h1 style={{ margin: 0, color: '#1B4B8C', fontWeight: 600 }}>Extraction Prompts</h1>
        <button style={{...styles.button, ...styles.buttonPrimary, display: 'flex', alignItems: 'center', gap: '8px'}}>
          <Plus size={16} />
          Create Prompt
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
        <div style={styles.glassCard}>
          <h3 style={{ marginTop: 0, color: '#1B4B8C', fontWeight: 600 }}>Prompts</h3>
          {prompts.map((prompt) => (
            <div
              key={prompt.id}
              onClick={() => setSelected(prompt.id)}
              style={{
                padding: '12px',
                marginBottom: '8px',
                borderRadius: '8px',
                cursor: 'pointer',
                background: selected === prompt.id ? 'rgba(46, 124, 228, 0.15)' : 'rgba(248, 249, 250, 0.8)',
                border: selected === prompt.id ? '1px solid rgba(46, 124, 228, 0.3)' : '1px solid rgba(27, 75, 140, 0.1)',
                transition: 'all 0.3s ease'
              }}
            >
              <div style={{ fontWeight: 500, color: '#1B4B8C' }}>{prompt.vendor} - {prompt.name}</div>
              <div style={{ fontSize: '12px', color: '#6C757D', marginTop: '4px' }}>
                Version {prompt.version} (Active)
              </div>
            </div>
          ))}
        </div>

        <div style={styles.glassCard}>
          <h3 style={{ marginTop: 0, color: '#1B4B8C', fontWeight: 600 }}>Genesys - Default Prompt (v3)</h3>
          <textarea
            style={{
              ...styles.input,
              minHeight: '300px',
              fontFamily: 'monospace',
              fontSize: '13px',
              resize: 'vertical'
            }}
            defaultValue="You are an invoice data extraction specialist. Extract the following information from the provided invoice and return it as a JSON object.

**Required Invoice Header Fields:**
- invoice_number (string, required)
- invoice_date (YYYY-MM-DD format)
- due_date (YYYY-MM-DD format)
..."
          />
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button style={{...styles.button, ...styles.buttonPrimary}}>
              Save New Version
            </button>
            <button style={{...styles.button, ...styles.buttonGlass, display: 'flex', alignItems: 'center', gap: '8px'}}>
              <Play size={16} />
              Test Prompt
            </button>
            <button style={{...styles.button, ...styles.buttonGlass}}>
              View History
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ExportScreen = () => {
  const [invoiceSet, setInvoiceSet] = useState('batch');
  
  return (
    <div>
      <h1 style={{ marginTop: 0, marginBottom: '24px', color: '#1B4B8C', fontWeight: 600 }}>Export AR Package</h1>

      <div style={styles.glassCard}>
        <h3 style={{ marginTop: 0, color: '#1B4B8C', fontWeight: 600 }}>Filters</h3>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: '#2C3E50' }}>
            Invoice Set
          </label>
          <select 
            style={styles.select}
            value={invoiceSet}
            onChange={(e) => setInvoiceSet(e.target.value)}
          >
            <option value="batch">Current Import Batch</option>
            <option value="daterange">Date Range</option>
            <option value="all">All Approved</option>
          </select>
        </div>
        
        {invoiceSet === 'batch' && (
          <div style={styles.alertInfo}>
            <strong>Batch #1234</strong> - Five9 - Imported on 10/03/2024 (3 invoices)
          </div>
        )}
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: '#2C3E50' }}>
              Start Date
            </label>
            <input 
              type="date" 
              style={{...styles.input, opacity: invoiceSet === 'batch' ? 0.5 : 1}}
              disabled={invoiceSet === 'batch'}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: '#2C3E50' }}>
              End Date
            </label>
            <input 
              type="date" 
              style={{...styles.input, opacity: invoiceSet === 'batch' ? 0.5 : 1}}
              disabled={invoiceSet === 'batch'}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: '#2C3E50' }}>
              Vendor
            </label>
            <select 
              style={{...styles.select, opacity: invoiceSet === 'batch' ? 0.5 : 1}}
              disabled={invoiceSet === 'batch'}
            >
              <option>All Vendors</option>
              <option>Genesys</option>
              <option>Five9</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: '#2C3E50' }}>
              Status
            </label>
            <select style={styles.select}>
              <option>Approved Only</option>
              <option>All Statuses</option>
            </select>
          </div>
        </div>
      </div>

      <div style={styles.glassCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: '#1B4B8C', fontWeight: 600 }}>Invoices (12 selected)</h3>
          <div>
            <button style={{...styles.button, ...styles.buttonGlass, marginRight: '8px', padding: '8px 16px'}}>
              Select All
            </button>
            <button style={{...styles.button, ...styles.buttonGlass, padding: '8px 16px'}}>
              Deselect All
            </button>
          </div>
        </div>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{...styles.th, width: '40px'}}>
                <input type="checkbox" defaultChecked />
              </th>
              <th style={styles.th}>Invoice #</th>
              <th style={styles.th}>Vendor</th>
              <th style={styles.th}>Customer</th>
              <th style={styles.th}>Date</th>
              <th style={styles.th}>Amount</th>
              <th style={styles.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={styles.td}>
                <input type="checkbox" defaultChecked />
              </td>
              <td style={styles.td}>INV01208704</td>
              <td style={styles.td}>Five9</td>
              <td style={styles.td}>Christian Healthcare</td>
              <td style={styles.td}>2024-10-01</td>
              <td style={styles.td}>$47,646.21</td>
              <td style={styles.td}>
                <span style={{...styles.chip, ...styles.chipSuccess}}>Approved</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={styles.glassCard}>
        <h3 style={{ marginTop: 0, color: '#1B4B8C', fontWeight: 600 }}>Export Options</h3>
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '8px', color: '#2C3E50' }}>
            <input type="checkbox" defaultChecked style={{ marginRight: '8px' }} />
            Include CSV Files
          </label>
          <label style={{ display: 'block', marginBottom: '8px', color: '#2C3E50' }}>
            <input type="checkbox" defaultChecked style={{ marginRight: '8px' }} />
            Include Excel File
          </label>
          <label style={{ display: 'block', color: '#2C3E50' }}>
            <input type="checkbox" defaultChecked style={{ marginRight: '8px' }} />
            Include Invoice PDFs/HTML
          </label>
        </div>
        <button style={{...styles.button, ...styles.buttonPrimary, display: 'flex', alignItems: 'center', gap: '8px'}}>
          <Download size={20} />
          Generate AR Package
        </button>
      </div>
    </div>
  );
};

export default function InvoiceApp() {
  const [screen, setScreen] = useState('import');

  const menuItems = [
    { key: 'import', label: 'Import Invoices', icon: Upload },
    { key: 'review', label: 'Review & Approve', icon: CheckCircle },
    { key: 'vendors', label: 'Vendors', icon: Building2 },
    { key: 'customers', label: 'Customers', icon: Users },
    { key: 'prompts', label: 'Prompts', icon: Code },
    { key: 'export', label: 'Export', icon: Download }
  ];

  return (
    <div style={styles.app}>
      <div style={styles.header}>
        <BarChart3 size={24} style={{ marginRight: '16px' }} />
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 500 }}>
          Waterfield Technologies - Invoice Processing
        </h2>
      </div>

      <div style={styles.sidebar}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.key}
              style={{
                ...styles.menuItem,
                ...(screen === item.key ? styles.menuItemActive : {})
              }}
              onClick={() => setScreen(item.key)}
            >
              <Icon size={20} style={{ marginRight: '12px' }} />
              {item.label}
            </div>
          );
        })}
      </div>

      <div style={styles.content}>
        {screen === 'import' && <ImportScreen />}
        {screen === 'review' && <ReviewScreen />}
        {screen === 'vendors' && <VendorsScreen />}
        {screen === 'prompts' && <PromptsScreen />}
        {screen === 'export' && <ExportScreen />}
        {screen === 'customers' && (
          <div>
            <h1 style={{ color: '#1B4B8C', fontWeight: 600 }}>Customers</h1>
            <div style={styles.glassCard}>
              <p style={{ color: '#2C3E50' }}>Customer management interface (similar to Vendors screen)</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}