import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Button,
  Chip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Card,
  CardContent,
  Grid,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
} from '@mui/material';
import {
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  FileText,
  Filter,
  Search,
  Download,
  TrendingUp,
  AlertTriangle,
  Trash2,
  Database,
} from 'lucide-react';
import axios from 'axios';
import { format, parseISO } from 'date-fns';

const InvoicesPage = () => {
  const [invoices, setInvoices] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedInvoices, setSelectedInvoices] = useState(new Set());

  // Filters and pagination
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    vendor: '',
    dateRange: 'all'
  });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0
  });

  // Load invoices on component mount and filter changes
  useEffect(() => {
    loadInvoices();
  }, [filters, page, rowsPerPage]);

  // Load vendors once on component mount
  useEffect(() => {
    loadVendors();
  }, []);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page + 1,
        limit: rowsPerPage,
        ...(filters.search && { search: filters.search }),
        ...(filters.status && { status: filters.status }),
        ...(filters.vendor && { vendor_id: filters.vendor }),
        ...(filters.dateRange !== 'all' && { date_range: filters.dateRange })
      });

      const response = await axios.get(`/api/invoices?${params}`);
      setInvoices(response.data.invoices);

      // Calculate stats from all invoices
      const totalInvoices = response.data.total_invoices || response.data.invoices;
      setStats({
        total: Array.isArray(totalInvoices) ? totalInvoices.length : response.data.total || 0,
        pending: totalInvoices.filter(inv => inv.processing_status === 'processed').length,
        approved: totalInvoices.filter(inv => inv.processing_status === 'approved').length,
        rejected: totalInvoices.filter(inv => inv.processing_status === 'rejected').length,
      });
    } catch (err) {
      console.error('Failed to load invoices:', err);
      setError('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const loadVendors = async () => {
    try {
      const response = await axios.get('/api/vendors');
      setVendors(response.data.vendors || []);
    } catch (err) {
      console.error('Failed to load vendors:', err);
      // Don't set error for vendors, it's not critical
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(0); // Reset to first page when filtering
  };

  const handleViewInvoice = async (invoice) => {
    try {
      const response = await axios.get(`/api/invoices/${invoice.id}`);
      setSelectedInvoice(response.data.invoice);
      setViewDialogOpen(true);
    } catch (err) {
      console.error('Failed to load invoice details:', err);
      setError('Failed to load invoice details');
    }
  };

  const handleDeleteInvoice = (invoice) => {
    setInvoiceToDelete(invoice);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    try {
      setDeleting(true);
      
      if (invoiceToDelete) {
        // Single invoice delete
        await axios.delete(`/api/invoices/${invoiceToDelete.id}`);
        console.log(`Invoice ${invoiceToDelete.invoice_number} deleted successfully`);
      } else if (selectedInvoices.size > 0) {
        // Bulk delete
        const deletePromises = Array.from(selectedInvoices).map(id => 
          axios.delete(`/api/invoices/${id}`)
        );
        await Promise.all(deletePromises);
        console.log(`${selectedInvoices.size} invoices deleted successfully`);
        setSelectedInvoices(new Set());
      }
      
      // Refresh the list
      await loadInvoices();
      setDeleteDialogOpen(false);
      setInvoiceToDelete(null);
      
    } catch (err) {
      console.error('Failed to delete invoice(s):', err);
      setError('Failed to delete invoice(s). Some invoices may have been deleted.');
    } finally {
      setDeleting(false);
    }
  };

  const getStatusChip = (status) => {
    const config = {
      processed: { color: 'warning', icon: <Clock size={16} />, label: 'Pending Review' },
      approved: { color: 'success', icon: <CheckCircle size={16} />, label: 'Approved' },
      rejected: { color: 'error', icon: <XCircle size={16} />, label: 'Rejected' }
    };

    const statusConfig = config[status] || { color: 'default', icon: <AlertTriangle size={16} />, label: 'Unknown' };

    return (
      <Chip
        icon={statusConfig.icon}
        label={statusConfig.label}
        color={statusConfig.color}
        size="small"
        variant="outlined"
      />
    );
  };

  const formatCurrency = (amount) => {
    if (!amount) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return format(parseISO(dateString), 'MMM dd, yyyy');
    } catch {
      return 'Invalid Date';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <Database size={32} color="#1B4B8C" />
          <Typography variant="h4">
            Invoices
          </Typography>
        </Box>
        {selectedInvoices.size > 0 && (
          <Button
            variant="contained"
            color="error"
            startIcon={<Trash2 size={16} />}
            onClick={() => setDeleteDialogOpen(true)}
          >
            Delete Selected ({selectedInvoices.size})
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Summary Stats */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <FileText size={24} color="#1B4B8C" />
                <Box>
                  <Typography variant="h6">{stats.total}</Typography>
                  <Typography variant="body2" color="text.secondary">Total Invoices</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <Clock size={24} color="#f57c00" />
                <Box>
                  <Typography variant="h6">{stats.pending}</Typography>
                  <Typography variant="body2" color="text.secondary">Pending Review</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <CheckCircle size={24} color="#4caf50" />
                <Box>
                  <Typography variant="h6">{stats.approved}</Typography>
                  <Typography variant="body2" color="text.secondary">Approved</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <XCircle size={24} color="#f44336" />
                <Box>
                  <Typography variant="h6">{stats.rejected}</Typography>
                  <Typography variant="body2" color="text.secondary">Rejected</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <Filter size={20} />
          <Typography variant="h6">Filters</Typography>
        </Box>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              placeholder="Search invoices..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              InputProps={{
                startAdornment: <Search size={20} style={{ marginRight: 8, color: '#666' }} />
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={filters.status}
                label="Status"
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <MenuItem value="">All Status</MenuItem>
                <MenuItem value="processed">Pending Review</MenuItem>
                <MenuItem value="approved">Approved</MenuItem>
                <MenuItem value="rejected">Rejected</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth>
              <InputLabel>Vendor</InputLabel>
              <Select
                value={filters.vendor}
                label="Vendor"
                onChange={(e) => handleFilterChange('vendor', e.target.value)}
              >
                <MenuItem value="">All Vendors</MenuItem>
                {vendors.map((vendor) => (
                  <MenuItem key={vendor.id} value={vendor.id}>
                    {vendor.display_name || vendor.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth>
              <InputLabel>Date Range</InputLabel>
              <Select
                value={filters.dateRange}
                label="Date Range"
                onChange={(e) => handleFilterChange('dateRange', e.target.value)}
              >
                <MenuItem value="all">All Time</MenuItem>
                <MenuItem value="today">Today</MenuItem>
                <MenuItem value="week">This Week</MenuItem>
                <MenuItem value="month">This Month</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Invoice Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selectedInvoices.size > 0 && selectedInvoices.size < invoices.length}
                    checked={invoices.length > 0 && selectedInvoices.size === invoices.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedInvoices(new Set(invoices.map(inv => inv.id)));
                      } else {
                        setSelectedInvoices(new Set());
                      }
                    }}
                  />
                </TableCell>
                <TableCell>Invoice #</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Vendor</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id} hover>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedInvoices.has(invoice.id)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedInvoices);
                        if (e.target.checked) {
                          newSelected.add(invoice.id);
                        } else {
                          newSelected.delete(invoice.id);
                        }
                        setSelectedInvoices(newSelected);
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {invoice.invoice_number}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {invoice.customer_name || 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {invoice.vendor_display_name || invoice.vendor_name || 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {formatCurrency(invoice.total_amount)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(invoice.invoice_date)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {getStatusChip(invoice.processing_status)}
                  </TableCell>
                  <TableCell>
                    <Box display="flex" gap={1}>
                      <Tooltip title="View Invoice">
                        <IconButton
                          size="small"
                          onClick={() => handleViewInvoice(invoice)}
                          color="primary"
                        >
                          <Eye size={16} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete Invoice">
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteInvoice(invoice)}
                          color="error"
                        >
                          <Trash2 size={16} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={stats.total}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(event, newPage) => setPage(newPage)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(parseInt(event.target.value, 10));
            setPage(0);
          }}
        />
      </Paper>

      {/* View Invoice Dialog */}
      <Dialog 
        open={viewDialogOpen} 
        onClose={() => setViewDialogOpen(false)} 
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
        <DialogTitle>View Invoice</DialogTitle>
        <DialogContent dividers sx={{ p: 0, height: '70vh' }}>
          {selectedInvoice && (
            <Grid container sx={{ height: '100%' }}>
              {/* Left Panel - Document Viewer */}
              <Grid item xs={12} sm={8} md={8} lg={8} sx={{ borderRight: 1, borderColor: 'divider', height: '100%' }}>
                <Box sx={{ p: 2, height: '100%' }}>
                  <Typography variant="h6" gutterBottom>
                    Original Document
                  </Typography>
                  <Box
                    component="iframe"
                    src={`http://localhost:5001/api/invoices/${selectedInvoice.id}/file?token=${localStorage.getItem('token')}`}
                    sx={{
                      width: '100%',
                      height: 'calc(100% - 40px)',
                      border: '1px solid #ddd',
                      borderRadius: 1,
                    }}
                  />
                </Box>
              </Grid>

              {/* Right Panel - Extracted Data */}
              <Grid item xs={12} sm={4} md={4} lg={4} sx={{ height: '100%', overflow: 'auto' }}>
                <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
                  <Typography variant="h6" gutterBottom>
                    Extracted Data
                  </Typography>
                  
                  {/* Invoice Details */}
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Invoice Details</Typography>
                    <Grid container spacing={1}>
                      <Grid item xs={6}>
                        <Typography variant="body2"><strong>Invoice #:</strong> {selectedInvoice.invoice_number}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2"><strong>Customer:</strong> {selectedInvoice.customer_name}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2"><strong>Date:</strong> {formatDate(selectedInvoice.invoice_date)}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2"><strong>Due Date:</strong> {formatDate(selectedInvoice.due_date)}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2"><strong>Total:</strong> {formatCurrency(selectedInvoice.total_amount)}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2"><strong>Status:</strong> {selectedInvoice.processing_status}</Typography>
                      </Grid>
                    </Grid>

                    {/* Amount Breakdown - Show if available */}
                    {(selectedInvoice.subtotal || selectedInvoice.total_taxes || selectedInvoice.total_fees) && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Amount Breakdown</Typography>
                        <Grid container spacing={1}>
                          {selectedInvoice.subtotal && (
                            <Grid item xs={6}>
                              <Typography variant="body2"><strong>Subtotal:</strong> {formatCurrency(selectedInvoice.subtotal)}</Typography>
                            </Grid>
                          )}
                          {selectedInvoice.total_taxes && (
                            <Grid item xs={6}>
                              <Typography variant="body2"><strong>Taxes:</strong> {formatCurrency(selectedInvoice.total_taxes)}</Typography>
                            </Grid>
                          )}
                          {selectedInvoice.total_fees && (
                            <Grid item xs={6}>
                              <Typography variant="body2"><strong>Fees:</strong> {formatCurrency(selectedInvoice.total_fees)}</Typography>
                            </Grid>
                          )}
                          {selectedInvoice.amount_due && (
                            <Grid item xs={6}>
                              <Typography variant="body2"><strong>Amount Due:</strong> {formatCurrency(selectedInvoice.amount_due)}</Typography>
                            </Grid>
                          )}
                        </Grid>
                      </Box>
                    )}

                    {/* Service Period & Terms - Show if available */}
                    {(selectedInvoice.service_period_start || selectedInvoice.service_period_end || selectedInvoice.payment_terms || selectedInvoice.purchase_order_number) && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Terms & Service Period</Typography>
                        <Grid container spacing={1}>
                          {selectedInvoice.purchase_order_number && (
                            <Grid item xs={12}>
                              <Typography variant="body2"><strong>PO Number:</strong> {selectedInvoice.purchase_order_number}</Typography>
                            </Grid>
                          )}
                          {selectedInvoice.payment_terms && (
                            <Grid item xs={12}>
                              <Typography variant="body2"><strong>Payment Terms:</strong> {selectedInvoice.payment_terms}</Typography>
                            </Grid>
                          )}
                          {selectedInvoice.service_period_start && (
                            <Grid item xs={6}>
                              <Typography variant="body2"><strong>Service Start:</strong> {formatDate(selectedInvoice.service_period_start)}</Typography>
                            </Grid>
                          )}
                          {selectedInvoice.service_period_end && (
                            <Grid item xs={6}>
                              <Typography variant="body2"><strong>Service End:</strong> {formatDate(selectedInvoice.service_period_end)}</Typography>
                            </Grid>
                          )}
                        </Grid>
                      </Box>
                    )}

                    {/* Contact Info - Show if available */}
                    {(selectedInvoice.contact_email || selectedInvoice.contact_phone || selectedInvoice.customer_account_number) && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Customer Contact</Typography>
                        <Grid container spacing={1}>
                          {selectedInvoice.customer_account_number && (
                            <Grid item xs={12}>
                              <Typography variant="body2"><strong>Account #:</strong> {selectedInvoice.customer_account_number}</Typography>
                            </Grid>
                          )}
                          {selectedInvoice.contact_email && (
                            <Grid item xs={12}>
                              <Typography variant="body2"><strong>Email:</strong> {selectedInvoice.contact_email}</Typography>
                            </Grid>
                          )}
                          {selectedInvoice.contact_phone && (
                            <Grid item xs={12}>
                              <Typography variant="body2"><strong>Phone:</strong> {selectedInvoice.contact_phone}</Typography>
                            </Grid>
                          )}
                        </Grid>
                      </Box>
                    )}
                  </Box>

                  {/* Line Items */}
                  {selectedInvoice.line_items && selectedInvoice.line_items.length > 0 && (
                    <Box>
                      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Line Items</Typography>
                      {selectedInvoice.line_items.map((item, index) => (
                        <Box key={index} sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                            {item.description}
                          </Typography>
                          <Grid container spacing={1} sx={{ mb: 1 }}>
                            <Grid item xs={6}>
                              <Typography variant="caption">
                                <strong>Qty:</strong> {item.quantity} {item.unit_of_measure && `(${item.unit_of_measure})`}
                              </Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="caption">
                                <strong>Unit Price:</strong> {formatCurrency(item.unit_price)}
                              </Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="caption">
                                <strong>Total:</strong> {formatCurrency(item.total_amount)}
                              </Typography>
                            </Grid>
                            {item.category && (
                              <Grid item xs={6}>
                                <Typography variant="caption">
                                  <strong>Category:</strong> {item.category}
                                </Typography>
                              </Grid>
                            )}
                          </Grid>
                          {(item.charge_type || item.sku || item.product_code) && (
                            <Grid container spacing={1}>
                              {item.charge_type && (
                                <Grid item xs={4}>
                                  <Typography variant="caption" color="text.secondary">
                                    {item.charge_type}
                                  </Typography>
                                </Grid>
                              )}
                              {item.sku && (
                                <Grid item xs={4}>
                                  <Typography variant="caption" color="text.secondary">
                                    SKU: {item.sku}
                                  </Typography>
                                </Grid>
                              )}
                              {item.product_code && (
                                <Grid item xs={4}>
                                  <Typography variant="caption" color="text.secondary">
                                    Code: {item.product_code}
                                  </Typography>
                                </Grid>
                              )}
                            </Grid>
                          )}
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => !deleting && setDeleteDialogOpen(false)} maxWidth="sm">
        <DialogTitle>
          {invoiceToDelete ? 'Delete Invoice' : `Delete ${selectedInvoices.size} Invoices`}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            {invoiceToDelete 
              ? `Are you sure you want to permanently delete invoice "${invoiceToDelete.invoice_number}"?`
              : `Are you sure you want to permanently delete ${selectedInvoices.size} selected invoice${selectedInvoices.size === 1 ? '' : 's'}?`
            }
          </Typography>
          <Alert severity="warning">
            This action cannot be undone and will remove all related data and files.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button 
            onClick={confirmDelete} 
            color="error" 
            variant="contained"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} /> : <Trash2 size={16} />}
          >
            {deleting 
              ? `Deleting${selectedInvoices.size > 1 ? ` (${selectedInvoices.size})` : ''}...` 
              : `Delete${selectedInvoices.size > 1 ? ` (${selectedInvoices.size})` : ''} Permanently`
            }
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default InvoicesPage;