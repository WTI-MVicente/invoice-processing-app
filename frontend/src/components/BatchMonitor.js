import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Button
} from '@mui/material';
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Pause,
  Play,
  Eye,
  FileText
} from 'lucide-react';
import axios from 'axios';
import { format } from 'date-fns';

const BatchMonitor = ({ batchId, onComplete, autoRefresh = true, showDetails = true }) => {
  const [, setBatch] = useState(null);
  const [progress, setProgress] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [hasNotifiedCompletion, setHasNotifiedCompletion] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  
  // Use refs to track current state in interval callbacks
  const progressRef = useRef(null);
  const isRateLimitedRef = useRef(false);
  const isPausedRef = useRef(false);

  const loadBatchData = useCallback(async () => {
    if (!batchId || isPaused || isRateLimited) return;
    
    // Don't make API calls if we already know the batch is completed
    if (progress && ['completed', 'failed', 'partial'].includes(progress.status)) {
      console.log('Batch already completed, skipping API call');
      return;
    }

    try {
      setError('');
      
      // Single API call with optional file details - reduces API calls by 50%!
      const progressRes = await axios.get(`/api/batches/${batchId}/progress`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params: showDetails ? { includeFiles: 'true' } : {}
      });

      const progressData = progressRes.data;
      setProgress(progressData);
      progressRef.current = progressData; // Update ref

      if (showDetails && progressData.files) {
        setFiles(progressData.files);
        // Create mock batch object from progress data
        setBatch({
          id: batchId,
          status: progressData.status,
          created_at: progressData.startedAt,
          total_files: progressData.totalFiles
        });
      }

      // Check if processing is complete and we haven't notified yet
      if (['completed', 'failed', 'partial'].includes(progressData.status)) {
        console.log(`Batch ${batchId} completed with status: ${progressData.status}`);
        if (onComplete && !hasNotifiedCompletion) {
          setHasNotifiedCompletion(true);
          onComplete(progressData);
        }
      }

    } catch (err) {
      console.error('Error loading batch data:', err);
      
      // If we get a rate limit error, completely disable the component
      if (err.response?.status === 429) {
        setIsRateLimited(true);
        setIsPaused(true);
        isRateLimitedRef.current = true;
        isPausedRef.current = true;
        setError('Rate limit exceeded. Monitoring disabled to prevent further errors.');
      } else {
        setError(err.response?.data?.error || 'Failed to load batch data');
      }
    } finally {
      setLoading(false);
    }
  }, [batchId, isPaused, isRateLimited, onComplete, showDetails, hasNotifiedCompletion, progress]);

  // Update refs when state changes
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);
  
  useEffect(() => {
    isRateLimitedRef.current = isRateLimited;
  }, [isRateLimited]);
  
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Auto-refresh effect - completely rewritten to avoid closure issues
  useEffect(() => {
    if (!autoRefresh || !batchId) return;
    
    console.log(`Setting up polling for batch ${batchId}`);
    
    const interval = setInterval(() => {
      // Check current state using refs (always up to date)
      if (isRateLimitedRef.current || isPausedRef.current) {
        console.log('Polling skipped: paused or rate limited');
        return;
      }
      
      // Check if batch is completed using current ref value
      if (progressRef.current && ['completed', 'failed', 'partial'].includes(progressRef.current.status)) {
        console.log('Batch completed, stopping polling:', progressRef.current.status);
        clearInterval(interval);
        return;
      }
      
      // Make the API call directly here instead of calling loadBatchData
      loadBatchDataDirect();
    }, 5000); // Poll every 5 seconds instead of 2 (reduces API calls by 60%)

    return () => {
      console.log(`Cleaning up polling interval for batch ${batchId}`);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, batchId]); // Minimal dependencies - loadBatchDataDirect intentionally excluded to prevent infinite loops

  // Separate function for direct API calls from interval
  const loadBatchDataDirect = async () => {
    if (!batchId) return;
    
    // Final check using refs
    if (isRateLimitedRef.current || isPausedRef.current) return;
    
    if (progressRef.current && ['completed', 'failed', 'partial'].includes(progressRef.current.status)) {
      console.log('Batch already completed, skipping API call');
      return;
    }

    try {
      setError('');
      
      // Single API call with optional file details - reduces API calls by 50%!
      const progressRes = await axios.get(`/api/batches/${batchId}/progress`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params: showDetails ? { includeFiles: 'true' } : {}
      });

      const progressData = progressRes.data;
      setProgress(progressData);
      progressRef.current = progressData;

      if (showDetails && progressData.files) {
        setFiles(progressData.files);
        // Create mock batch object from progress data
        setBatch({
          id: batchId,
          status: progressData.status,
          created_at: progressData.startedAt,
          total_files: progressData.totalFiles
        });
      }

      // Check if processing is complete and we haven't notified yet
      if (['completed', 'failed', 'partial'].includes(progressData.status)) {
        console.log(`Batch ${batchId} completed with status: ${progressData.status}`);
        if (onComplete && !hasNotifiedCompletion) {
          setHasNotifiedCompletion(true);
          onComplete(progressData);
        }
      }

    } catch (err) {
      console.error('Error loading batch data:', err);
      
      if (err.response?.status === 429) {
        setIsRateLimited(true);
        setIsPaused(true);
        isRateLimitedRef.current = true;
        isPausedRef.current = true;
        setError('Rate limit exceeded. Monitoring disabled to prevent further errors.');
      } else {
        setError(err.response?.data?.error || 'Failed to load batch data');
      }
    }
  };

  // Reset rate limiting when batchId changes
  useEffect(() => {
    if (batchId) {
      setIsRateLimited(false);
      setHasNotifiedCompletion(false);
      isRateLimitedRef.current = false;
      isPausedRef.current = false;
    }
  }, [batchId]);

  // Initial load when batchId changes and not rate limited
  useEffect(() => {
    if (batchId && !isRateLimited) {
      loadBatchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, isRateLimited]); // loadBatchData intentionally excluded to prevent infinite loops

  const getStatusColor = (status) => {
    switch (status) {
      // Batch-level statuses
      case 'completed': return 'success';
      case 'partial': return 'warning';
      
      // File-level statuses
      case 'processed': return 'success';  // Green for successfully processed files
      case 'failed': return 'error';       // Red for failed files
      case 'processing': return 'info';    // Blue for currently processing (already good)
      case 'pending': return 'default';    // Grey for pending files (already good)
      
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      // Batch-level statuses
      case 'completed': return <CheckCircle size={16} />;
      case 'partial': return <AlertTriangle size={16} />;
      
      // File-level statuses  
      case 'processed': return <CheckCircle size={16} />;  // Check icon for processed files
      case 'failed': return <XCircle size={16} />;         // X icon for failed files
      case 'processing': return <CircularProgress size={16} />; // Spinner for processing (already good)
      case 'pending': return <Clock size={16} />;          // Clock for pending files (already good)
      
      default: return <Clock size={16} />;
    }
  };

  const formatDuration = (startTime, endTime) => {
    if (!startTime) return 'Not started';
    if (!endTime && progress?.status === 'processing') {
      const duration = Date.now() - new Date(startTime).getTime();
      return `${Math.floor(duration / 1000)}s (ongoing)`;
    }
    if (!endTime) return 'In progress';
    
    const duration = new Date(endTime).getTime() - new Date(startTime).getTime();
    return `${Math.floor(duration / 1000)}s`;
  };

  const handlePauseToggle = () => {
    const newPausedState = !isPaused;
    setIsPaused(newPausedState);
    isPausedRef.current = newPausedState;
  };

  const handleRefresh = () => {
    setLoading(true);
    setError('');
    setIsPaused(false);
    setIsRateLimited(false);
    isPausedRef.current = false;
    isRateLimitedRef.current = false;
    loadBatchData();
  };

  if (loading && !progress) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" action={
        <Button onClick={handleRefresh} size="small">
          Retry
        </Button>
      }>
        {error}
      </Alert>
    );
  }

  if (!progress) {
    return (
      <Alert severity="info">
        No batch data available
      </Alert>
    );
  }

  return (
    <Box>
      {/* Progress Overview */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {getStatusIcon(progress.status)}
              Batch Processing Status
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title={isPaused ? 'Resume monitoring' : 'Pause monitoring'}>
                <IconButton size="small" onClick={handlePauseToggle}>
                  {isPaused ? <Play size={16} /> : <Pause size={16} />}
                </IconButton>
              </Tooltip>
              <Tooltip title="Refresh now">
                <IconButton size="small" onClick={handleRefresh}>
                  <RefreshCw size={16} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="success.main">
                  {progress.processedFiles}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Processed
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="error.main">
                  {progress.failedFiles}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Failed
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="info.main">
                  {progress.pendingFiles}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Pending
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4">
                  {progress.totalFiles}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total
                </Typography>
              </Box>
            </Grid>
          </Grid>

          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Progress: {progress.processedFiles + progress.failedFiles} of {progress.totalFiles} files
              </Typography>
              <Chip 
                label={progress.status}
                color={getStatusColor(progress.status)}
                size="small"
                icon={getStatusIcon(progress.status)}
              />
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={Math.min(progress.completionPercentage || 0, 100)} 
              sx={{ height: 8, borderRadius: 4 }}
            />
            <Typography variant="caption" color="text.secondary">
              {Math.min(progress.completionPercentage || 0, 100)}% complete
            </Typography>
          </Box>

          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">
                Started: {progress.startedAt ? format(new Date(progress.startedAt), 'MMM dd, HH:mm:ss') : 'Not started'}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">
                Duration: {formatDuration(progress.startedAt, progress.completedAt)}
              </Typography>
            </Grid>
          </Grid>

          {progress.errorMessage && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {progress.errorMessage}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Current Processing Status */}
      {progress.status === 'processing' && files.length > 0 && (
        <Card sx={{ 
          mb: 2,
          border: '2px solid',
          borderColor: 'primary.main',
          animation: 'pulse 2s infinite',
          '@keyframes pulse': {
            '0%': {
              borderColor: 'primary.main',
              boxShadow: '0 0 5px rgba(25, 118, 210, 0.3)'
            },
            '50%': {
              borderColor: 'primary.light',
              boxShadow: '0 0 20px rgba(25, 118, 210, 0.6)'
            },
            '100%': {
              borderColor: 'primary.main',
              boxShadow: '0 0 5px rgba(25, 118, 210, 0.3)'
            }
          }
        }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={20} />
              Current Processing Status
            </Typography>
            
            {(() => {
              const processingFile = files.find(f => f.status === 'processing');
              const pendingFiles = files.filter(f => f.status === 'pending');
              
              if (processingFile) {
                return (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                      <strong>Processing:</strong> {processingFile.filename}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <CircularProgress size={16} />
                      <Typography variant="body2" color="text.secondary">
                        Extracting invoice data... (~15 seconds per file)
                      </Typography>
                    </Box>
                    {processingFile.processed_at && (
                      <Typography variant="body2" color="text.secondary">
                        Started: {format(new Date(processingFile.processed_at), 'HH:mm:ss')}
                      </Typography>
                    )}
                  </Box>
                );
              }
              
              if (pendingFiles.length > 0) {
                return (
                  <Typography variant="body1">
                    <strong>Next up:</strong> {pendingFiles[0].filename} (+{pendingFiles.length - 1} more)
                  </Typography>
                );
              }
              
              return (
                <Typography variant="body1" color="text.secondary">
                  Finalizing batch processing...
                </Typography>
              );
            })()}

            {/* File Processing Details - Moved inside Current Processing Status */}
            {files.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  File Processing Details
                </Typography>
                <TableContainer sx={{ maxHeight: 300 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Filename</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Invoice</TableCell>
                        <TableCell>Time</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {files.map((file) => (
                        <TableRow key={file.id} hover>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <FileText size={16} style={{ marginRight: 8 }} />
                              {file.filename}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={file.status}
                              color={getStatusColor(file.status)}
                              size="small"
                              icon={getStatusIcon(file.status)}
                            />
                          </TableCell>
                          <TableCell>
                            {file.invoice_number ? (
                              <Box>
                                <Typography variant="body2" fontWeight={500}>
                                  {file.invoice_number}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {file.customer_name}
                                </Typography>
                              </Box>
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                {file.status === 'failed' ? 'Failed' : 'Processing...'}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            {file.processing_time_ms ? `${Math.round(file.processing_time_ms / 1000)}s` : '-'}
                          </TableCell>
                          <TableCell>
                            {file.invoice_id && (
                              <Tooltip title="View invoice">
                                <IconButton
                                  size="small"
                                  onClick={() => window.location.href = `/review?invoice=${file.invoice_id}`}
                                >
                                  <Eye size={16} />
                                </IconButton>
                              </Tooltip>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

    </Box>
  );
};

export default BatchMonitor;