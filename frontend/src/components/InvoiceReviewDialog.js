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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Calendar,
  DollarSign,
  Phone,
  Mail,
  CreditCard,
} from 'lucide-react';
import axios from 'axios';
import { format, parseISO } from 'date-fns';
import { formatCurrency, formatQuantity } from '../utils/formatters';

const InvoiceReviewDialog = ({ 
  open, 
  onClose, 
  invoice, 
  onUpdate, 
  onApprove, 
  onReject, 
  onNavigateNext, 
  onNavigatePrevious, 
  hasNext = false, 
  hasPrevious = false 
}) => {
  const [editableInvoice, setEditableInvoice] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    amounts: false,
    dates: false,
    contact: false,
    lineItemDetails: false
  });

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
          service_period_start: formatDateForInput(invoice.service_period_start),
          service_period_end: formatDateForInput(invoice.service_period_end),
          currency: invoice.currency || 'USD',
          amount_due: invoice.amount_due || 0,
          total_amount: invoice.total_amount || 0,
          subtotal: invoice.subtotal || 0,
          total_taxes: invoice.total_taxes || 0,
          total_fees: invoice.total_fees || 0,
          total_recurring: invoice.total_recurring || 0,
          total_one_time: invoice.total_one_time || 0,
          total_usage: invoice.total_usage || 0,
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
          service_period_start: formatDateForInput(item.service_period_start),
          service_period_end: formatDateForInput(item.service_period_end),
          quantity: item.quantity || 1,
          unit_of_measure: item.unit_of_measure || '',
          unit_price: item.unit_price || 0,
          subtotal: item.subtotal || 0,
          tax_amount: item.tax_amount || 0,
          fee_amount: item.fee_amount || 0,
          total_amount: item.total_amount || 0,
          sku: item.sku || '',
          product_code: item.product_code || '',
        })) || []
      });
      
      // Set file URL for document viewer (use full backend URL with auth token)
      const token = localStorage.getItem('token');
      setFileUrl(`http://localhost:5001/api/invoices/${invoice.id}/file?token=${token}`);
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


  // Formatting helpers for input fields
  const formatCurrencyInput = (value) => {
    if (!value || value === 0) return '0.00';
    return parseFloat(value).toFixed(2);
  };

  const formatQuantityInput = (value) => {
    if (!value || value === 0) return '0.0';
    return parseFloat(value).toFixed(1);
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

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const CollapsibleSection = ({ title, icon, section, children, defaultExpanded = false }) => {
    const isExpanded = expandedSections[section];
    
    return (
      <Box sx={{ mb: 2 }}>
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          onClick={() => toggleSection(section)}
          sx={{
            cursor: 'pointer',
            p: 1,
            borderRadius: 1,
            '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' },
            mb: isExpanded ? 1 : 0
          }}
        >
          <Box display="flex" alignItems="center" gap={1}>
            {icon}
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {title}
            </Typography>
          </Box>
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </Box>
        {isExpanded && (
          <Box sx={{ pl: 1 }}>
            {children}
          </Box>
        )}
      </Box>
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
          service_period_start: '',
          service_period_end: '',
          quantity: 1,
          unit_of_measure: '',
          unit_price: 0,
          subtotal: 0,
          tax_amount: 0,
          fee_amount: 0,
          total_amount: 0,
          sku: '',
          product_code: '',
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
    if (onApprove) {
      onApprove(invoice.id, true); // Auto-advance by default
    } else {
      // Fallback to original behavior
      try {
        await axios.put(`/api/invoices/${invoice.id}/approve`);
        onUpdate?.();
        onClose();
      } catch (err) {
        setError('Failed to approve invoice');
      }
    }
  };

  const handleReject = async () => {
    if (onReject) {
      onReject(invoice.id, ''); // Empty reason for now
    } else {
      // Fallback to original behavior
      try {
        await axios.put(`/api/invoices/${invoice.id}/reject`);
        onUpdate?.();
        onClose();
      } catch (err) {
        setError('Failed to reject invoice');
      }
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

              {/* Basic Information - Always Expanded */}
              <CollapsibleSection 
                title="Basic Information" 
                icon={<FileText size={16} />} 
                section="basic"
              >
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
                      label="Total Amount"
                      type={editMode ? "number" : "text"}
                      value={editMode ? formatCurrencyInput(editableInvoice.invoice_header.total_amount) : formatCurrency(editableInvoice.invoice_header.total_amount)}
                      onChange={(e) => handleFieldChange('invoice_header', 'total_amount', parseFloat(e.target.value) || 0)}
                      disabled={!editMode}
                      size="small"
                      InputProps={{ 
                        startAdornment: editMode ? '$' : '',
                        readOnly: !editMode
                      }}
                    />
                  </Grid>
                  <Grid item xs={6}>
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
              </CollapsibleSection>

              {/* Amount Breakdown */}
              <CollapsibleSection 
                title="Amount Breakdown" 
                icon={<DollarSign size={16} />} 
                section="amounts"
              >
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Subtotal"
                      type={editMode ? "number" : "text"}
                      value={editMode ? formatCurrencyInput(editableInvoice.invoice_header.subtotal) : formatCurrency(editableInvoice.invoice_header.subtotal)}
                      onChange={(e) => handleFieldChange('invoice_header', 'subtotal', parseFloat(e.target.value) || 0)}
                      disabled={!editMode}
                      size="small"
                      InputProps={{ 
                        startAdornment: editMode ? '$' : '',
                        readOnly: !editMode
                      }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Amount Due"
                      type={editMode ? "number" : "text"}
                      value={editMode ? formatCurrencyInput(editableInvoice.invoice_header.amount_due) : formatCurrency(editableInvoice.invoice_header.amount_due)}
                      onChange={(e) => handleFieldChange('invoice_header', 'amount_due', parseFloat(e.target.value) || 0)}
                      disabled={!editMode}
                      size="small"
                      InputProps={{ 
                        startAdornment: editMode ? '$' : '',
                        readOnly: !editMode
                      }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Total Taxes"
                      type={editMode ? "number" : "text"}
                      value={editMode ? formatCurrencyInput(editableInvoice.invoice_header.total_taxes) : formatCurrency(editableInvoice.invoice_header.total_taxes)}
                      onChange={(e) => handleFieldChange('invoice_header', 'total_taxes', parseFloat(e.target.value) || 0)}
                      disabled={!editMode}
                      size="small"
                      InputProps={{ 
                        startAdornment: editMode ? '$' : '',
                        readOnly: !editMode
                      }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Total Fees"
                      type={editMode ? "number" : "text"}
                      value={editMode ? formatCurrencyInput(editableInvoice.invoice_header.total_fees) : formatCurrency(editableInvoice.invoice_header.total_fees)}
                      onChange={(e) => handleFieldChange('invoice_header', 'total_fees', parseFloat(e.target.value) || 0)}
                      disabled={!editMode}
                      size="small"
                      InputProps={{ 
                        startAdornment: editMode ? '$' : '',
                        readOnly: !editMode
                      }}
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField
                      fullWidth
                      label="Recurring Total"
                      type={editMode ? "number" : "text"}
                      value={editMode ? formatCurrencyInput(editableInvoice.invoice_header.total_recurring) : formatCurrency(editableInvoice.invoice_header.total_recurring)}
                      onChange={(e) => handleFieldChange('invoice_header', 'total_recurring', parseFloat(e.target.value) || 0)}
                      disabled={!editMode}
                      size="small"
                      InputProps={{ 
                        startAdornment: editMode ? '$' : '',
                        readOnly: !editMode
                      }}
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField
                      fullWidth
                      label="One-Time Total"
                      type={editMode ? "number" : "text"}
                      value={editMode ? formatCurrencyInput(editableInvoice.invoice_header.total_one_time) : formatCurrency(editableInvoice.invoice_header.total_one_time)}
                      onChange={(e) => handleFieldChange('invoice_header', 'total_one_time', parseFloat(e.target.value) || 0)}
                      disabled={!editMode}
                      size="small"
                      InputProps={{ 
                        startAdornment: editMode ? '$' : '',
                        readOnly: !editMode
                      }}
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField
                      fullWidth
                      label="Usage Total"
                      type={editMode ? "number" : "text"}
                      value={editMode ? formatCurrencyInput(editableInvoice.invoice_header.total_usage) : formatCurrency(editableInvoice.invoice_header.total_usage)}
                      onChange={(e) => handleFieldChange('invoice_header', 'total_usage', parseFloat(e.target.value) || 0)}
                      disabled={!editMode}
                      size="small"
                      InputProps={{ 
                        startAdornment: editMode ? '$' : '',
                        readOnly: !editMode
                      }}
                    />
                  </Grid>
                </Grid>
              </CollapsibleSection>

              {/* Dates & Service Periods */}
              <CollapsibleSection 
                title="Dates & Service Periods" 
                icon={<Calendar size={16} />} 
                section="dates"
              >
                <Grid container spacing={2}>
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
                      label="Issue Date"
                      type="date"
                      value={editableInvoice.invoice_header.issue_date}
                      onChange={(e) => handleFieldChange('invoice_header', 'issue_date', e.target.value)}
                      disabled={!editMode}
                      size="small"
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Payment Terms"
                      value={editableInvoice.invoice_header.payment_terms}
                      onChange={(e) => handleFieldChange('invoice_header', 'payment_terms', e.target.value)}
                      disabled={!editMode}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Service Period Start"
                      type="date"
                      value={editableInvoice.invoice_header.service_period_start}
                      onChange={(e) => handleFieldChange('invoice_header', 'service_period_start', e.target.value)}
                      disabled={!editMode}
                      size="small"
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Service Period End"
                      type="date"
                      value={editableInvoice.invoice_header.service_period_end}
                      onChange={(e) => handleFieldChange('invoice_header', 'service_period_end', e.target.value)}
                      disabled={!editMode}
                      size="small"
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                </Grid>
              </CollapsibleSection>

              {/* Contact & Account Information */}
              <CollapsibleSection 
                title="Customer Contact & Account" 
                icon={<CreditCard size={16} />} 
                section="contact"
              >
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Customer Account Number"
                      value={editableInvoice.invoice_header.customer_account_number}
                      onChange={(e) => handleFieldChange('invoice_header', 'customer_account_number', e.target.value)}
                      disabled={!editMode}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Contact Email"
                      value={editableInvoice.invoice_header.contact_email}
                      onChange={(e) => handleFieldChange('invoice_header', 'contact_email', e.target.value)}
                      disabled={!editMode}
                      size="small"
                      InputProps={{ startAdornment: <Mail size={16} style={{ marginRight: 8, color: '#666' }} /> }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Contact Phone"
                      value={editableInvoice.invoice_header.contact_phone}
                      onChange={(e) => handleFieldChange('invoice_header', 'contact_phone', e.target.value)}
                      disabled={!editMode}
                      size="small"
                      InputProps={{ startAdornment: <Phone size={16} style={{ marginRight: 8, color: '#666' }} /> }}
                    />
                  </Grid>
                </Grid>
              </CollapsibleSection>

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

              {/* Line Items - Compact Table */}
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 200, mb: 2 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ minWidth: 120 }}>Description</TableCell>
                      <TableCell align="right" sx={{ width: 80 }}>Qty</TableCell>
                      <TableCell align="right" sx={{ width: 80 }}>Unit Price</TableCell>
                      <TableCell align="right" sx={{ width: 80 }}>Total</TableCell>
                      {editMode && <TableCell align="center" sx={{ width: 50 }}>Actions</TableCell>}
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
                              multiline
                              maxRows={2}
                            />
                          ) : (
                            <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                              {item.description}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {editMode ? (
                            <TextField
                              type="number"
                              value={formatQuantityInput(item.quantity)}
                              onChange={(e) => handleLineItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                              size="small"
                              variant="standard"
                              sx={{ width: 60, textAlign: 'right' }}
                              inputProps={{ step: "0.1" }}
                            />
                          ) : (
                            <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                              {formatQuantity(item.quantity, item.unit_of_measure)}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {editMode ? (
                            <TextField
                              type="number"
                              value={formatCurrencyInput(item.unit_price)}
                              onChange={(e) => handleLineItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                              size="small"
                              variant="standard"
                              sx={{ width: 70 }}
                              InputProps={{ startAdornment: '$' }}
                              inputProps={{ step: "0.01" }}
                            />
                          ) : (
                            <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                              {formatCurrency(item.unit_price)}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {editMode ? (
                            <TextField
                              type="number"
                              value={formatCurrencyInput(item.total_amount)}
                              onChange={(e) => handleLineItemChange(index, 'total_amount', parseFloat(e.target.value) || 0)}
                              size="small"
                              variant="standard"
                              sx={{ width: 70 }}
                              InputProps={{ startAdornment: '$' }}
                              inputProps={{ step: "0.01" }}
                            />
                          ) : (
                            <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 500 }}>
                              {formatCurrency(item.total_amount)}
                            </Typography>
                          )}
                        </TableCell>
                        {editMode && (
                          <TableCell align="center">
                            <IconButton
                              size="small"
                              onClick={() => removeLineItem(index)}
                              color="error"
                            >
                              <Trash2 size={14} />
                            </IconButton>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Line Item Details - Expandable */}
              <CollapsibleSection 
                title="Line Item Details" 
                icon={<Eye size={16} />} 
                section="lineItemDetails"
              >
                {editableInvoice.line_items.map((item, index) => (
                  <Box key={index} sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                      Line {index + 1}: {item.description || 'Untitled Item'}
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          label="Category"
                          value={item.category}
                          onChange={(e) => handleLineItemChange(index, 'category', e.target.value)}
                          disabled={!editMode}
                          size="small"
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          label="Charge Type"
                          value={item.charge_type}
                          onChange={(e) => handleLineItemChange(index, 'charge_type', e.target.value)}
                          disabled={!editMode}
                          size="small"
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          label="Unit of Measure"
                          value={item.unit_of_measure}
                          onChange={(e) => handleLineItemChange(index, 'unit_of_measure', e.target.value)}
                          disabled={!editMode}
                          size="small"
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          label="SKU"
                          value={item.sku}
                          onChange={(e) => handleLineItemChange(index, 'sku', e.target.value)}
                          disabled={!editMode}
                          size="small"
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          label="Product Code"
                          value={item.product_code}
                          onChange={(e) => handleLineItemChange(index, 'product_code', e.target.value)}
                          disabled={!editMode}
                          size="small"
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          label="Subtotal"
                          type="number"
                          value={item.subtotal}
                          onChange={(e) => handleLineItemChange(index, 'subtotal', parseFloat(e.target.value) || 0)}
                          disabled={!editMode}
                          size="small"
                          InputProps={{ startAdornment: '$' }}
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          label="Tax Amount"
                          type="number"
                          value={item.tax_amount}
                          onChange={(e) => handleLineItemChange(index, 'tax_amount', parseFloat(e.target.value) || 0)}
                          disabled={!editMode}
                          size="small"
                          InputProps={{ startAdornment: '$' }}
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          label="Fee Amount"
                          type="number"
                          value={item.fee_amount}
                          onChange={(e) => handleLineItemChange(index, 'fee_amount', parseFloat(e.target.value) || 0)}
                          disabled={!editMode}
                          size="small"
                          InputProps={{ startAdornment: '$' }}
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          label="Service Period Start"
                          type="date"
                          value={item.service_period_start}
                          onChange={(e) => handleLineItemChange(index, 'service_period_start', e.target.value)}
                          disabled={!editMode}
                          size="small"
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          label="Service Period End"
                          type="date"
                          value={item.service_period_end}
                          onChange={(e) => handleLineItemChange(index, 'service_period_end', e.target.value)}
                          disabled={!editMode}
                          size="small"
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                    </Grid>
                  </Box>
                ))}
              </CollapsibleSection>
            </Box>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button 
          variant="outlined"
          onClick={onClose} 
          disabled={saving}
          startIcon={<X size={16} />}
        >
          Close
        </Button>

        {/* Navigation buttons */}
        <Button
          variant="outlined"
          onClick={() => {
            console.log('Back clicked, hasPrevious:', hasPrevious);
            onNavigatePrevious?.();
          }}
          disabled={!hasPrevious || saving}
          startIcon={<ChevronLeft size={16} />}
          sx={{ ml: 1 }}
        >
          Back
        </Button>
        <Button
          variant="outlined"
          onClick={() => {
            console.log('Next clicked, hasNext:', hasNext);
            onNavigateNext?.();
          }}
          disabled={!hasNext || saving}
          startIcon={<ChevronRight size={16} />}
        >
          Next
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