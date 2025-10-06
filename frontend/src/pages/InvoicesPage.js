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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

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
    if (!invoiceToDelete) return;

    try {
      setDeleting(true);
      await axios.delete(`/api/invoices/${invoiceToDelete.id}`);
      
      // Refresh the list
      loadInvoices();
      setDeleteDialogOpen(false);
      setInvoiceToDelete(null);
      
      // Show success message
      console.log(`Invoice ${invoiceToDelete.invoice_number} deleted successfully`);
    } catch (err) {
      console.error('Failed to delete invoice:', err);
      setError('Failed to delete invoice');
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
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Database size={32} color="#1B4B8C" />
        <Typography variant="h4">
          Invoices
        </Typography>
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
                {/* TODO: Load vendors dynamically */}
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
                <TableCell>Invoice #</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id} hover>
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
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle1" fontWeight="bold">Invoice Details</Typography>
                    <Typography variant="body2">Invoice #: {selectedInvoice.invoice_number}</Typography>
                    <Typography variant="body2">Customer: {selectedInvoice.customer_name}</Typography>
                    <Typography variant="body2">Amount: {formatCurrency(selectedInvoice.total_amount)}</Typography>
                    <Typography variant="body2">Date: {formatDate(selectedInvoice.invoice_date)}</Typography>
                    <Typography variant="body2">Status: {selectedInvoice.processing_status}</Typography>
                  </Box>

                  {/* Line Items */}
                  {selectedInvoice.line_items && selectedInvoice.line_items.length > 0 && (
                    <Box>
                      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Line Items</Typography>
                      {selectedInvoice.line_items.map((item, index) => (
                        <Box key={index} sx={{ mb: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                          <Typography variant="body2">{item.description}</Typography>
                          <Typography variant="caption">
                            Qty: {item.quantity} × {formatCurrency(item.unit_price)} = {formatCurrency(item.total_amount)}
                          </Typography>
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
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to permanently delete invoice "{invoiceToDelete?.invoice_number}"?
            This action cannot be undone and will remove all related data and files.
          </Typography>
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
            {deleting ? 'Deleting...' : 'Delete Permanently'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default InvoicesPage;