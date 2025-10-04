import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  Typography,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  Chip,
  IconButton,
  Tooltip,
  LinearProgress,
  Alert,
  Divider,
} from '@mui/material';
import {
  Save,
  X,
  CheckCircle,
  XCircle,
  Edit,
  Plus,
  Trash2,
  FileText,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import axios from 'axios';
import { format, parseISO } from 'date-fns';

const InvoiceReviewDialog = ({ open, onClose, invoice, onUpdate }) => {
  const [editableInvoice, setEditableInvoice] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);

  // Initialize editable invoice data
  useEffect(() => {
    if (invoice) {
      setEditableInvoice({
        invoice_header: {
          invoice_number: invoice.invoice_number || '',
          customer_name: invoice.customer_name || '',
          invoice_date: formatDateForInput(invoice.invoice_date),
          due_date: formatDateForInput(invoice.due_date),
          issue_date: formatDateForInput(invoice.issue_date),
          currency: invoice.currency || 'USD',
          amount_due: invoice.amount_due || 0,
          total_amount: invoice.total_amount || 0,
          subtotal: invoice.subtotal || 0,
          total_taxes: invoice.total_taxes || 0,
          total_fees: invoice.total_fees || 0,
          purchase_order_number: invoice.purchase_order_number || '',
          payment_terms: invoice.payment_terms || '',
          customer_account_number: invoice.customer_account_number || '',
          contact_email: invoice.contact_email || '',
          contact_phone: invoice.contact_phone || '',
        },
        line_items: invoice.line_items?.map(item => ({
          line_number: item.line_number || 1,
          description: item.description || '',
          category: item.category || '',
          charge_type: item.charge_type || 'one_time',
          quantity: item.quantity || 1,
          unit_price: item.unit_price || 0,
          total_amount: item.total_amount || 0,
        })) || []
      });
      
      // Set file URL for document viewer
      setFileUrl(`/api/invoices/${invoice.id}/file`);
    }
  }, [invoice]);

  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    try {
      return format(parseISO(dateString), 'yyyy-MM-dd');
    } catch {
      return '';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return format(parseISO(dateString), 'MMM dd, yyyy');
    } catch {
      return 'Invalid date';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const getConfidenceColor = (score) => {
    if (score >= 0.9) return 'success';
    if (score >= 0.7) return 'warning';
    return 'error';
  };

  const getStatusChip = (status) => {
    const config = {
      processed: { color: 'warning', icon: <AlertTriangle size={16} />, label: 'Pending Review' },
      approved: { color: 'success', icon: <CheckCircle size={16} />, label: 'Approved' },
      rejected: { color: 'error', icon: <XCircle size={16} />, label: 'Rejected' },
    };
    
    const { color, icon, label } = config[status] || { color: 'default', icon: null, label: status };
    
    return (
      <Chip
        icon={icon}
        label={label}
        color={color}
        size="small"
        variant="outlined"
      />
    );
  };

  const handleFieldChange = (section, field, value) => {
    setEditableInvoice(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleLineItemChange = (index, field, value) => {
    setEditableInvoice(prev => ({
      ...prev,
      line_items: prev.line_items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const addLineItem = () => {
    setEditableInvoice(prev => ({
      ...prev,
      line_items: [
        ...prev.line_items,
        {
          line_number: prev.line_items.length + 1,
          description: '',
          category: '',
          charge_type: 'one_time',
          quantity: 1,
          unit_price: 0,
          total_amount: 0,
        }
      ]
    }));
  };

  const removeLineItem = (index) => {
    setEditableInvoice(prev => ({
      ...prev,
      line_items: prev.line_items.filter((_, i) => i !== index)
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      
      await axios.put(`/api/invoices/${invoice.id}/update`, editableInvoice);
      
      setEditMode(false);
      onUpdate?.(); // Refresh parent data
      
    } catch (err) {
      console.error('Failed to save invoice:', err);
      setError(err.response?.data?.error || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    try {
      await axios.put(`/api/invoices/${invoice.id}/approve`);
      onUpdate?.();
      onClose();
    } catch (err) {
      setError('Failed to approve invoice');
    }
  };

  const handleReject = async () => {
    try {
      await axios.put(`/api/invoices/${invoice.id}/reject`);
      onUpdate?.();
      onClose();
    } catch (err) {
      setError('Failed to reject invoice');
    }
  };

  if (!invoice || !editableInvoice) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      PaperProps={{
        sx: { 
          width: '95vw', 
          height: '90vh',
          maxWidth: 'none',
          maxHeight: 'none'
        }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={2}>
            <FileText size={24} color="#1B4B8C" />
            <Typography variant="h6">
              Invoice Review: {invoice.invoice_number}
            </Typography>
            {getStatusChip(invoice.processing_status)}
          </Box>
          <Box display="flex" alignItems="center" gap={2}>
            <LinearProgress
              variant="determinate"
              value={(invoice.confidence_score || 0) * 100}
              color={getConfidenceColor(invoice.confidence_score)}
              sx={{ width: 100, height: 8, borderRadius: 4 }}
            />
            <Typography variant="body2" fontWeight={500}>
              {Math.round((invoice.confidence_score || 0) * 100)}% Confidence
            </Typography>
            {!editMode && invoice.processing_status === 'processed' && (
              <Tooltip title="Edit Invoice Data">
                <IconButton onClick={() => setEditMode(true)} color="primary">
                  <Edit size={20} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0, height: '70vh' }}>
        {error && (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container sx={{ height: '100%' }}>
          {/* Left Panel - Document Viewer */}
          <Grid item xs={6} sx={{ borderRight: 1, borderColor: 'divider', height: '100%' }}>
            <Box sx={{ p: 2, height: '100%' }}>
              <Typography variant="h6" gutterBottom>
                Original Document
              </Typography>
              {fileUrl && (
                <Box
                  component="iframe"
                  src={fileUrl}
                  sx={{
                    width: '100%',
                    height: 'calc(100% - 40px)',
                    border: '1px solid #ddd',
                    borderRadius: 1,
                  }}
                />
              )}
            </Box>
          </Grid>

          {/* Right Panel - Editable Data */}
          <Grid item xs={6} sx={{ height: '100%', overflow: 'auto' }}>
            <Box sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Extracted Data
                {editMode && (
                  <Chip 
                    label="Edit Mode" 
                    color="warning" 
                    size="small" 
                    sx={{ ml: 1 }} 
                  />
                )}
              </Typography>

              {/* Invoice Header */}
              <Typography variant="subtitle1" sx={{ mt: 2, mb: 1, fontWeight: 600 }}>
                Invoice Information
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Invoice Number"
                    value={editableInvoice.invoice_header.invoice_number}
                    onChange={(e) => handleFieldChange('invoice_header', 'invoice_number', e.target.value)}
                    disabled={!editMode}
                    size="small"
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Customer Name"
                    value={editableInvoice.invoice_header.customer_name}
                    onChange={(e) => handleFieldChange('invoice_header', 'customer_name', e.target.value)}
                    disabled={!editMode}
                    size="small"
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Invoice Date"
                    type="date"
                    value={editableInvoice.invoice_header.invoice_date}
                    onChange={(e) => handleFieldChange('invoice_header', 'invoice_date', e.target.value)}
                    disabled={!editMode}
                    size="small"
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Due Date"
                    type="date"
                    value={editableInvoice.invoice_header.due_date}
                    onChange={(e) => handleFieldChange('invoice_header', 'due_date', e.target.value)}
                    disabled={!editMode}
                    size="small"
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Total Amount"
                    type="number"
                    value={editableInvoice.invoice_header.total_amount}
                    onChange={(e) => handleFieldChange('invoice_header', 'total_amount', parseFloat(e.target.value) || 0)}
                    disabled={!editMode}
                    size="small"
                    InputProps={{ startAdornment: '$' }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Amount Due"
                    type="number"
                    value={editableInvoice.invoice_header.amount_due}
                    onChange={(e) => handleFieldChange('invoice_header', 'amount_due', parseFloat(e.target.value) || 0)}
                    disabled={!editMode}
                    size="small"
                    InputProps={{ startAdornment: '$' }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Purchase Order Number"
                    value={editableInvoice.invoice_header.purchase_order_number}
                    onChange={(e) => handleFieldChange('invoice_header', 'purchase_order_number', e.target.value)}
                    disabled={!editMode}
                    size="small"
                  />
                </Grid>
              </Grid>

              <Divider sx={{ my: 3 }} />

              {/* Line Items */}
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Line Items
                </Typography>
                {editMode && (
                  <Button
                    startIcon={<Plus size={16} />}
                    onClick={addLineItem}
                    size="small"
                    variant="outlined"
                  >
                    Add Item
                  </Button>
                )}
              </Box>

              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Description</TableCell>
                      <TableCell align="right">Quantity</TableCell>
                      <TableCell align="right">Unit Price</TableCell>
                      <TableCell align="right">Total</TableCell>
                      {editMode && <TableCell align="center">Actions</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {editableInvoice.line_items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          {editMode ? (
                            <TextField
                              fullWidth
                              value={item.description}
                              onChange={(e) => handleLineItemChange(index, 'description', e.target.value)}
                              size="small"
                              variant="standard"
                            />
                          ) : (
                            item.description
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {editMode ? (
                            <TextField
                              type="number"
                              value={item.quantity}
                              onChange={(e) => handleLineItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                              size="small"
                              variant="standard"
                              sx={{ width: 80 }}
                            />
                          ) : (
                            item.quantity
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {editMode ? (
                            <TextField
                              type="number"
                              value={item.unit_price}
                              onChange={(e) => handleLineItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                              size="small"
                              variant="standard"
                              sx={{ width: 100 }}
                              InputProps={{ startAdornment: '$' }}
                            />
                          ) : (
                            formatCurrency(item.unit_price)
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {editMode ? (
                            <TextField
                              type="number"
                              value={item.total_amount}
                              onChange={(e) => handleLineItemChange(index, 'total_amount', parseFloat(e.target.value) || 0)}
                              size="small"
                              variant="standard"
                              sx={{ width: 100 }}
                              InputProps={{ startAdornment: '$' }}
                            />
                          ) : (
                            formatCurrency(item.total_amount)
                          )}
                        </TableCell>
                        {editMode && (
                          <TableCell align="center">
                            <IconButton
                              size="small"
                              onClick={() => removeLineItem(index)}
                              color="error"
                            >
                              <Trash2 size={16} />
                            </IconButton>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Close
        </Button>
        
        {editMode ? (
          <>
            <Button 
              onClick={() => setEditMode(false)} 
              disabled={saving}
              startIcon={<X size={16} />}
            >
              Cancel Edit
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving}
              startIcon={saving ? <LinearProgress size={16} /> : <Save size={16} />}
              sx={{ background: 'linear-gradient(135deg, #1B4B8C, #2E7CE4)' }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </>
        ) : invoice.processing_status === 'processed' && (
          <>
            <Button
              variant="outlined"
              color="error"
              startIcon={<XCircle size={16} />}
              onClick={handleReject}
            >
              Reject
            </Button>
            <Button
              variant="contained"
              color="success"
              startIcon={<CheckCircle size={16} />}
              onClick={handleApprove}
              sx={{ background: 'linear-gradient(135deg, #2e7d32, #66bb6a)' }}
            >
              Approve
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default InvoiceReviewDialog;