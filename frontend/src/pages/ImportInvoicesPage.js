import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Card,
  CardContent,
  Grid,
  Alert,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Upload,
  FolderOpen,
  FileText,
  Play,
  X,
  RefreshCw
} from 'lucide-react';
import axios from 'axios';
import BatchMonitor from '../components/BatchMonitor';

const ImportInvoicesPage = () => {
  // State management
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState('');
  const [files, setFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [processing, setProcessing] = useState(false);
  const [currentBatch, setCurrentBatch] = useState(null);
  const [, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  // Load vendors on component mount
  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = async () => {
    try {
      const response = await axios.get('/api/vendors', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setVendors(response.data.vendors || []);
    } catch (error) {
      console.error('Error loading vendors:', error);
      setError('Failed to load vendors');
    }
  };

  const handleFileSelection = (event) => {
    const selectedFiles = Array.from(event.target.files);
    const validFiles = selectedFiles.filter(file => {
      const ext = file.name.toLowerCase().split('.').pop();
      return ['pdf', 'html'].includes(ext);
    });

    if (validFiles.length !== selectedFiles.length) {
      setError('Some files were skipped. Only PDF and HTML files are supported.');
    }

    const fileObjects = validFiles.map((file, index) => ({
      id: `file-${Date.now()}-${index}`,
      file,
      name: file.name,
      size: file.size,
      type: file.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'HTML',
      selected: true
    }));

    setFiles(fileObjects);
    setSelectedFiles(new Set(fileObjects.map(f => f.id)));
    setError('');
  };

  const handleFolderSelection = (event) => {
    // Note: Folder selection has limited browser support
    // This is a fallback implementation
    handleFileSelection(event);
  };

  const handleFileToggle = (fileId) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId);
    } else {
      newSelected.add(fileId);
    }
    setSelectedFiles(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(files.map(f => f.id)));
    }
  };

  const removeFile = (fileId) => {
    const newFiles = files.filter(f => f.id !== fileId);
    const newSelected = new Set(selectedFiles);
    newSelected.delete(fileId);
    
    setFiles(newFiles);
    setSelectedFiles(newSelected);
  };

  const startProcessing = async () => {
    if (!selectedVendor) {
      setError('Please select a vendor');
      return;
    }

    if (selectedFiles.size === 0) {
      setError('Please select at least one file');
      return;
    }

    setProcessing(true);
    setError('');

    try {
      // Step 1: Initialize batch
      const batchResponse = await axios.post('/api/batches/init', {
        vendor_id: selectedVendor
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      const batch = batchResponse.data.batch;
      setCurrentBatch(batch);

      // Step 2: Upload selected files
      const selectedFileObjects = files.filter(f => selectedFiles.has(f.id));
      const formData = new FormData();
      
      selectedFileObjects.forEach(fileObj => {
        formData.append('files', fileObj.file);
      });

      // Add vendor name for proper folder organization
      const vendor = vendors.find(v => v.id === selectedVendor);
      formData.append('vendor_name', vendor?.name || 'unknown');

      const uploadResponse = await axios.post(`/api/batches/${batch.id}/files`, formData, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      console.log('Files uploaded:', uploadResponse.data);

      // Step 3: Start processing
      const processResponse = await axios.post(`/api/batches/${batch.id}/process`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      console.log('Processing started:', processResponse.data);

    } catch (error) {
      console.error('Error starting processing:', error);
      setError(error.response?.data?.error || 'Failed to start processing');
      setProcessing(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'partial': return 'warning';
      case 'processing': return 'info';
      default: return 'default';
    }
  };

  const resetForm = () => {
    setFiles([]);
    setSelectedFiles(new Set());
    setSelectedVendor('');
    setCurrentBatch(null);
    setProgress(null);
    setResults(null);
    setProcessing(false);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
          Import Invoices
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Upload and process multiple invoice files in batch
        </Typography>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Step 1: Vendor Selection */}
      {!processing && !results && (
        <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Step 1: Select Vendor
        </Typography>
        <FormControl fullWidth disabled={processing}>
          <InputLabel>Vendor</InputLabel>
          <Select
            value={selectedVendor}
            label="Vendor"
            onChange={(e) => setSelectedVendor(e.target.value)}
          >
            {vendors.map((vendor) => (
              <MenuItem key={vendor.id} value={vendor.id}>
                {vendor.display_name || vendor.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        </Paper>
      )}

      {/* Step 2: File Selection */}
      {!processing && !results && (
        <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Step 2: Select Files
        </Typography>
        
        <Box sx={{ mb: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Upload />}
            onClick={() => fileInputRef.current?.click()}
            disabled={processing}
            sx={{ mr: 2 }}
          >
            Select Files
          </Button>
          <Button
            variant="outlined"
            startIcon={<FolderOpen />}
            onClick={() => folderInputRef.current?.click()}
            disabled={processing}
          >
            Select Folder
          </Button>
          
          {/* Hidden file inputs */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.html"
            onChange={handleFileSelection}
            style={{ display: 'none' }}
          />
          <input
            ref={folderInputRef}
            type="file"
            webkitdirectory=""
            onChange={handleFolderSelection}
            style={{ display: 'none' }}
          />
        </Box>

        {/* File List */}
        {files.length > 0 && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1">
                Files ({selectedFiles.size} of {files.length} selected)
              </Typography>
              <Button
                size="small"
                onClick={handleSelectAll}
                disabled={processing}
              >
                {selectedFiles.size === files.length ? 'Deselect All' : 'Select All'}
              </Button>
            </Box>

            <TableContainer sx={{ maxHeight: 400 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedFiles.size === files.length && files.length > 0}
                        indeterminate={selectedFiles.size > 0 && selectedFiles.size < files.length}
                        onChange={handleSelectAll}
                        disabled={processing}
                      />
                    </TableCell>
                    <TableCell>File Name</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Size</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {files.map((file) => (
                    <TableRow key={file.id} hover>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedFiles.has(file.id)}
                          onChange={() => handleFileToggle(file.id)}
                          disabled={processing}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <FileText size={16} style={{ marginRight: 8 }} />
                          {file.name}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={file.type} 
                          size="small" 
                          color={file.type === 'PDF' ? 'primary' : 'secondary'}
                        />
                      </TableCell>
                      <TableCell>{formatFileSize(file.size)}</TableCell>
                      <TableCell>
                        <Tooltip title="Remove file">
                          <IconButton
                            size="small"
                            onClick={() => removeFile(file.id)}
                            disabled={processing}
                          >
                            <X size={16} />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
        </Paper>
      )}

      {/* Step 3: Process */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          {processing ? 'Processing Files' : 'Step 3: Process Files'}
        </Typography>
        
        {(!selectedVendor || selectedFiles.size === 0) && !processing && !results && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {!selectedVendor ? 'Please select a vendor in Step 1 to continue' : 'Please select at least one file in Step 2 to continue'}
          </Typography>
        )}
        
        {!processing && !results && (
          <Button
            variant={(!selectedVendor || selectedFiles.size === 0) ? "outlined" : "contained"}
            startIcon={<Play />}
            onClick={startProcessing}
            disabled={!selectedVendor || selectedFiles.size === 0}
            size="large"
            sx={{
              ...((!selectedVendor || selectedFiles.size === 0) && {
                backgroundColor: '#f5f5f5',
                borderColor: '#d0d0d0',
                color: '#a0a0a0',
                cursor: 'not-allowed',
                '&:hover': {
                  backgroundColor: '#f5f5f5',
                  borderColor: '#d0d0d0',
                },
                '&:disabled': {
                  backgroundColor: '#f5f5f5',
                  borderColor: '#d0d0d0',
                  color: '#a0a0a0',
                },
                '& .MuiButton-startIcon': {
                  color: '#a0a0a0'
                }
              })
            }}
          >
            Start Processing
          </Button>
        )}

        {currentBatch && processing && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              Processing Batch
            </Typography>
            <BatchMonitor
              batchId={currentBatch.id}
              autoRefresh={true}
              showDetails={true}
              onComplete={(progressData) => {
                setProcessing(false);
                setResults(progressData);
              }}
            />
          </Box>
        )}

        {results && (
          <Card sx={{ mt: 2, bgcolor: 'background.paper' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Processing Complete
              </Typography>
              
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="success.main">
                      {results.processedFiles}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Processed
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="error.main">
                      {results.failedFiles}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Failed
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4">
                      {results.totalFiles}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Files
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Chip 
                      label={results.status} 
                      color={getStatusColor(results.status)}
                      size="medium"
                    />
                  </Box>
                </Grid>
              </Grid>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="contained"
                  onClick={() => window.location.href = '/review'}
                >
                  Review Invoices
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<RefreshCw />}
                  onClick={resetForm}
                >
                  Import More Files
                </Button>
              </Box>
            </CardContent>
          </Card>
        )}
      </Paper>
    </Box>
  );
};

export default ImportInvoicesPage;