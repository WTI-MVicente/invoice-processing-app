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
} from 'lucide-react';
import axios from 'axios';
import { format, parseISO } from 'date-fns';
import InvoiceReviewDialog from '../components/InvoiceReviewDialog';

const ReviewPage = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  
  // Filters and pagination
  const [filters, setFilters] = useState({
    status: '',
    vendor: '',
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

  // Load invoices on component mount and filter changes
  useEffect(() => {
    loadInvoices();
  }, [filters, page, rowsPerPage]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: rowsPerPage,
        offset: page * rowsPerPage,
        ...(filters.status && { status: filters.status }),
        ...(filters.vendor && { vendor_id: filters.vendor }),
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

  const handleApprove = async (invoiceId) => {
    try {
      await axios.put(`/api/invoices/${invoiceId}/approve`);
      loadInvoices(); // Refresh list
      setDetailDialogOpen(false);
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
        <Eye size={32} color="#1B4B8C" />
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
                <MenuItem value="genesys">Genesys</MenuItem>
                <MenuItem value="five9">Five9</MenuItem>
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
          {loading && <LinearProgress />}
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Invoice #</TableCell>
                <TableCell>Vendor</TableCell>
                <TableCell>Customer</TableCell>
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
      />
    </Box>
  );
};

export default ReviewPage;