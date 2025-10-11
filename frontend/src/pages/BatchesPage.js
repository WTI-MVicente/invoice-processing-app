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
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  LinearProgress,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Eye,
  Play,
  RefreshCw,
  Trash2,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import axios from 'axios';
import { format, parseISO } from 'date-fns';
import BatchMonitor from '../components/BatchMonitor';

const BatchesPage = () => {
  const [batches, setBatches] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [monitorDialog, setMonitorDialog] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');

  const loadBatches = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        ...(statusFilter && { status: statusFilter })
      };

      const response = await axios.get('/api/batches', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params
      });

      setBatches(response.data.batches);
      setTotalCount(response.data.pagination.total);
    } catch (err) {
      console.error('Error loading batches:', err);
      setError('Failed to load batches');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, statusFilter]);

  useEffect(() => {
    loadBatches();
    loadVendors();
  }, [loadBatches, page, rowsPerPage, statusFilter]);

  const loadVendors = async () => {
    try {
      const response = await axios.get('/api/vendors', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setVendors(response.data.vendors || []);
    } catch (err) {
      console.error('Error loading vendors:', err);
    }
  };

  const handleViewBatch = (batch) => {
    setSelectedBatch(batch);
    setMonitorDialog(true);
  };

  const handleDeleteBatch = async (batchId) => {
    if (!window.confirm('Are you sure you want to delete this batch? This action cannot be undone.')) {
      return;
    }

    try {
      await axios.delete(`/api/batches/${batchId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      loadBatches(); // Reload the list
    } catch (err) {
      console.error('Error deleting batch:', err);
      setError(err.response?.data?.error || 'Failed to delete batch');
    }
  };

  const handleResumeBatch = async (batchId) => {
    try {
      await axios.post(`/api/batches/${batchId}/resume`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      loadBatches(); // Reload to see updated status
    } catch (err) {
      console.error('Error resuming batch:', err);
      setError(err.response?.data?.error || 'Failed to resume batch');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'partial': return 'warning';
      case 'processing': return 'info';
      case 'pending': return 'default';
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle size={16} />;
      case 'failed': return <XCircle size={16} />;
      case 'partial': return <AlertTriangle size={16} />;
      case 'processing': return <RefreshCw size={16} className="animate-spin" />;
      case 'pending': return <Clock size={16} />;
      default: return <Clock size={16} />;
    }
  };

  const getVendorName = (vendorId) => {
    const vendor = vendors.find(v => v.id === vendorId);
    return vendor?.display_name || vendor?.name || 'Unknown Vendor';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return format(parseISO(dateString), 'MMM dd, yyyy HH:mm');
  };

  const calculateProgress = (batch) => {
    if (!batch.total_file_count || batch.total_file_count === 0) return 0;
    const progress = Math.round(((batch.processed_count + batch.failed_count) / batch.total_file_count) * 100);
    return Math.min(progress, 100); // Cap at 100%
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
          Batch Management
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Monitor and manage invoice processing batches
        </Typography>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="success.main">
                {batches.filter(b => b.status === 'completed').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Completed
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="info.main">
                {batches.filter(b => b.status === 'processing').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Processing
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="error.main">
                {batches.filter(b => b.status === 'failed').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Failed
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4">
                {batches.reduce((sum, b) => sum + (b.total_file_count || 0), 0)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Files
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4} md={3}>
            <FormControl fullWidth>
              <InputLabel>Status Filter</InputLabel>
              <Select
                value={statusFilter}
                label="Status Filter"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="">All Statuses</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="processing">Processing</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="failed">Failed</MenuItem>
                <MenuItem value="partial">Partial</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item>
            <Button
              variant="outlined"
              startIcon={<RefreshCw size={16} />}
              onClick={loadBatches}
            >
              Refresh
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Batch Table */}
      <Paper>
        <TableContainer>
          {loading && <LinearProgress />}
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Batch ID</TableCell>
                <TableCell>Vendor</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Progress</TableCell>
                <TableCell>Files</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {batches.map((batch) => (
                <TableRow key={batch.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {batch.id.split('-')[0]}...
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {getVendorName(batch.vendor_id)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={batch.status}
                      color={getStatusColor(batch.status)}
                      size="small"
                      icon={getStatusIcon(batch.status)}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ width: '100px' }}>
                      <LinearProgress 
                        variant="determinate" 
                        value={calculateProgress(batch)} 
                        sx={{ height: 6, borderRadius: 3 }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {calculateProgress(batch)}%
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {batch.processed_count || 0}/{batch.total_file_count || 0}
                    </Typography>
                    {(batch.failed_count || 0) > 0 && (
                      <Typography variant="caption" color="error">
                        ({batch.failed_count} failed)
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(batch.created_at)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="View details">
                        <IconButton
                          size="small"
                          onClick={() => handleViewBatch(batch)}
                        >
                          <Eye size={16} />
                        </IconButton>
                      </Tooltip>
                      
                      {batch.status === 'failed' && (
                        <Tooltip title="Resume processing">
                          <IconButton
                            size="small"
                            onClick={() => handleResumeBatch(batch.id)}
                          >
                            <Play size={16} />
                          </IconButton>
                        </Tooltip>
                      )}
                      
                      {['completed', 'failed', 'partial'].includes(batch.status) && (
                        <Tooltip title="Delete batch">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteBatch(batch.id)}
                          >
                            <Trash2 size={16} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
              {batches.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Box sx={{ py: 3 }}>
                      <FileText size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
                      <Typography variant="body1" color="text.secondary">
                        No batches found
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Import some invoices to see batch processing history
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={totalCount}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(event, newPage) => setPage(newPage)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(parseInt(event.target.value, 10));
            setPage(0);
          }}
        />
      </Paper>

      {/* Batch Monitor Dialog */}
      <Dialog
        open={monitorDialog}
        onClose={() => setMonitorDialog(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { height: '90vh' }
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              Batch Monitor - {selectedBatch?.id.split('-')[0]}...
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {selectedBatch && getVendorName(selectedBatch.vendor_id)}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedBatch && (
            <BatchMonitor
              batchId={selectedBatch.id}
              autoRefresh={selectedBatch.status === 'processing'}  // Only auto-refresh if actively processing
              showDetails={true}
              onComplete={(progress) => {
                // Refresh the batch list when processing completes
                loadBatches();
              }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMonitorDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BatchesPage;