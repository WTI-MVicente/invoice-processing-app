import React, { useState, useEffect, useCallback } from 'react';
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
  LinearProgress,
} from '@mui/material';
import {
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  FileText,
  Filter,
  Search,
  TrendingUp,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import axios from 'axios';
import { format, parseISO } from 'date-fns';
import InvoiceReviewDialog from '../components/InvoiceReviewDialog';

const ReviewPage = () => {
  const [invoices, setInvoices] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  
  // Filters and pagination
  const [filters, setFilters] = useState({
    status: 'none', // Default to showing no items
    vendor: '',
    batch: '',
    search: '',
    dateRange: 'all'
  });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // Summary stats
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    avgConfidence: 0
  });

  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true);
      
      // If status is 'none', show empty table
      if (filters.status === 'none') {
        setInvoices([]);
        // Still load stats for the summary cards
        const statsResponse = await axios.get('/api/invoices');
        const totalInvoices = statsResponse.data.invoices;
        setStats({
          total: totalInvoices.length,
          pending: totalInvoices.filter(inv => inv.processing_status === 'processed').length,
          approved: totalInvoices.filter(inv => inv.processing_status === 'approved').length,
          rejected: totalInvoices.filter(inv => inv.processing_status === 'rejected').length,
          avgConfidence: totalInvoices.length > 0 
            ? (totalInvoices.reduce((sum, inv) => sum + (inv.confidence_score || 0), 0) / totalInvoices.length * 100).toFixed(1)
            : 0
        });
        setLoading(false);
        return;
      }

      const params = new URLSearchParams({
        limit: rowsPerPage,
        offset: page * rowsPerPage,
        ...(filters.status && { status: filters.status }),
        ...(filters.vendor && { vendor_id: filters.vendor }),
        ...(filters.batch && { batch_name: filters.batch }),
      });

      const response = await axios.get(`/api/invoices?${params}`);
      setInvoices(response.data.invoices);
      
      // Calculate summary stats
      const totalInvoices = response.data.invoices;
      setStats({
        total: totalInvoices.length,
        pending: totalInvoices.filter(inv => inv.processing_status === 'processed').length,
        approved: totalInvoices.filter(inv => inv.processing_status === 'approved').length,
        rejected: totalInvoices.filter(inv => inv.processing_status === 'rejected').length,
        avgConfidence: totalInvoices.length > 0 
          ? (totalInvoices.reduce((sum, inv) => sum + (inv.confidence_score || 0), 0) / totalInvoices.length * 100).toFixed(1)
          : 0
      });
      
    } catch (err) {
      console.error('Failed to load invoices:', err);
      setError('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [filters, page, rowsPerPage]);

  // Load invoices on component mount and filter changes
  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  // Load vendors and batches once on component mount
  useEffect(() => {
    loadVendors();
    loadBatches();
  }, []);

  // Auto-switch to "processed" status when there are pending reviews and currently on "none"
  useEffect(() => {
    if (filters.status === 'none' && stats.pending > 0) {
      console.log(`Found ${stats.pending} pending reviews, auto-switching to "processed" status`);
      setFilters(prev => ({ ...prev, status: 'processed' }));
    }
  }, [stats.pending, filters.status]);

  const loadVendors = async () => {
    try {
      const response = await axios.get('/api/vendors');
      setVendors(response.data.vendors || []);
    } catch (err) {
      console.error('Failed to load vendors:', err);
    }
  };

  const loadBatches = async () => {
    try {
      const response = await axios.get('/api/batches/names', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setBatches(response.data.batches);
    } catch (err) {
      console.error('Failed to load batches:', err);
      setBatches([]);
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
      setDetailDialogOpen(true);
    } catch (err) {
      console.error('Failed to load invoice details:', err);
      setError('Failed to load invoice details');
    }
  };

  const handleApprove = async (invoiceId, autoAdvance = true) => {
    try {
      await axios.put(`/api/invoices/${invoiceId}/approve`);
      loadInvoices(); // Refresh list
      
      if (autoAdvance) {
        // Auto-advance to next pending invoice
        const nextInvoice = getNextPendingInvoice();
        if (nextInvoice) {
          handleViewInvoice(nextInvoice);
        } else {
          setDetailDialogOpen(false);
        }
      } else {
        setDetailDialogOpen(false);
      }
    } catch (err) {
      console.error('Failed to approve invoice:', err);
      setError('Failed to approve invoice');
    }
  };

  const handleReject = async (invoiceId, reason = '') => {
    try {
      await axios.put(`/api/invoices/${invoiceId}/reject`, { reason });
      loadInvoices(); // Refresh list
      setDetailDialogOpen(false);
    } catch (err) {
      console.error('Failed to reject invoice:', err);
      setError('Failed to reject invoice');
    }
  };

  // Navigation helper functions
  const getPendingInvoices = () => {
    const pendingInvoices = invoices.filter(invoice => 
      invoice.processing_status === 'processed' && !invoice.approved_at && !invoice.rejected_at
    );
    return pendingInvoices;
  };

  const getCurrentInvoiceIndex = () => {
    if (!selectedInvoice) return -1;
    const pendingInvoices = getPendingInvoices();
    return pendingInvoices.findIndex(invoice => invoice.id === selectedInvoice.id);
  };

  const getNextPendingInvoice = () => {
    const pendingInvoices = getPendingInvoices();
    const currentIndex = getCurrentInvoiceIndex();
    if (currentIndex >= 0 && currentIndex < pendingInvoices.length - 1) {
      return pendingInvoices[currentIndex + 1];
    }
    return null;
  };

  const getPreviousPendingInvoice = () => {
    const pendingInvoices = getPendingInvoices();
    const currentIndex = getCurrentInvoiceIndex();
    if (currentIndex > 0) {
      return pendingInvoices[currentIndex - 1];
    }
    return null;
  };

  const handleNavigateNext = () => {
    const nextInvoice = getNextPendingInvoice();
    if (nextInvoice) {
      handleViewInvoice(nextInvoice);
    }
  };

  const handleNavigatePrevious = () => {
    const previousInvoice = getPreviousPendingInvoice();
    if (previousInvoice) {
      handleViewInvoice(previousInvoice);
    }
  };

  const handleClearInvoices = () => {
    console.log('Clear view clicked');
    // Clear the view by resetting filters and reloading
    setFilters({
      search: '',
      status: 'none', // Reset to default "none" status
      vendor: '',
      batch: '',
      dateRange: 'all'
    });
    setPage(0);
    setRowsPerPage(10);
    // Force reload of invoices
    setTimeout(() => {
      loadInvoices();
    }, 100);
  };

  const getStatusChip = (status) => {
    const config = {
      processed: { color: 'warning', icon: <Clock size={16} />, label: 'Pending Review' },
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

  const getConfidenceColor = (score) => {
    if (score >= 0.9) return 'success';
    if (score >= 0.7) return 'warning';
    return 'error';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    try {
      return format(parseISO(dateString), 'MMM dd, yyyy');
    } catch {
      return 'Invalid date';
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <CheckCircle size={32} color="#1B4B8C" />
        <Typography variant="h4">
          Review & Approve
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
                <CheckCircle size={24} color="#2e7d32" />
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
                <TrendingUp size={24} color="#1976d2" />
                <Box>
                  <Typography variant="h6">{stats.avgConfidence}%</Typography>
                  <Typography variant="body2" color="text.secondary">Avg Confidence</Typography>
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
          <Grid item xs={12} sm={6} md={2.4}>
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
          <Grid item xs={12} sm={6} md={2.4}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={filters.status}
                label="Status"
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <MenuItem value="none">-- Select Status --</MenuItem>
                <MenuItem value="">All Status</MenuItem>
                <MenuItem value="processed">Pending Review</MenuItem>
                <MenuItem value="approved">Approved</MenuItem>
                <MenuItem value="rejected">Rejected</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
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
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth>
              <InputLabel>Batch</InputLabel>
              <Select
                value={filters.batch}
                label="Batch"
                onChange={(e) => handleFilterChange('batch', e.target.value)}
              >
                <MenuItem value="">All Batches</MenuItem>
                <MenuItem value="Single Upload">Single Uploads</MenuItem>
                {batches.map((batch) => (
                  <MenuItem key={batch.name} value={batch.name}>
                    {batch.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
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
          <Grid item xs={12} sm={6} md={2}>
            <Button
              variant="outlined"
              startIcon={<Trash2 size={16} />}
              onClick={handleClearInvoices}
              color="warning"
              fullWidth
              sx={{ height: '56px' }} // Match the height of Select components
            >
              Clear View
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Invoice Table */}
      <Paper>
        <TableContainer>
          {loading && <LinearProgress />}
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Invoice #</TableCell>
                <TableCell>Vendor</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Batch</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Confidence</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id} hover>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <FileText size={16} />
                      <Typography variant="body2" fontWeight={500}>
                        {invoice.invoice_number || 'N/A'}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{invoice.vendor_display_name}</TableCell>
                  <TableCell>{invoice.customer_name}</TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {invoice.batch_name || 'Single Upload'}
                    </Typography>
                  </TableCell>
                  <TableCell>{formatDate(invoice.invoice_date)}</TableCell>
                  <TableCell>{formatCurrency(invoice.total_amount)}</TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <LinearProgress
                        variant="determinate"
                        value={(invoice.confidence_score || 0) * 100}
                        color={getConfidenceColor(invoice.confidence_score)}
                        sx={{ width: 60, height: 6, borderRadius: 3 }}
                      />
                      <Typography variant="body2" fontWeight={500}>
                        {Math.round((invoice.confidence_score || 0) * 100)}%
                      </Typography>
                      {invoice.confidence_score < 0.7 && (
                        <Tooltip title="Low confidence - review recommended">
                          <AlertTriangle size={16} color="#f57c00" />
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>{getStatusChip(invoice.processing_status)}</TableCell>
                  <TableCell>
                    <Box display="flex" gap={1}>
                      <Tooltip title="View Details">
                        <IconButton size="small" onClick={() => handleViewInvoice(invoice)}>
                          <Eye size={16} />
                        </IconButton>
                      </Tooltip>
                      {invoice.processing_status === 'processed' && (
                        <>
                          <Tooltip title="Approve">
                            <IconButton 
                              size="small" 
                              onClick={() => handleApprove(invoice.id)}
                              color="success"
                            >
                              <CheckCircle size={16} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Reject">
                            <IconButton 
                              size="small" 
                              onClick={() => handleReject(invoice.id)}
                              color="error"
                            >
                              <XCircle size={16} />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          rowsPerPageOptions={[10, 25, 50]}
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

      {/* Split-Screen Invoice Review Dialog */}
      <InvoiceReviewDialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        invoice={selectedInvoice}
        onUpdate={loadInvoices}
        onApprove={handleApprove}
        onReject={handleReject}
        onNavigateNext={() => {
          console.log('Navigate next called');
          handleNavigateNext();
        }}
        onNavigatePrevious={() => {
          console.log('Navigate previous called');
          handleNavigatePrevious();
        }}
        hasNext={(() => {
          const hasNext = getNextPendingInvoice() !== null;
          return hasNext;
        })()}
        hasPrevious={(() => {
          const hasPrev = getPreviousPendingInvoice() !== null;
          return hasPrev;
        })()}
      />
    </Box>
  );
};

export default ReviewPage;