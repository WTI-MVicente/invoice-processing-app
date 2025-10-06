import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Chip,
  LinearProgress,
} from '@mui/material';
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Activity
} from 'lucide-react';
import axios from 'axios';

const ImportPage = () => {
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Load vendors on component mount
  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = async () => {
    try {
      const response = await axios.get('/api/vendors');
      setVendors(response.data.vendors.filter(v => v.active));
    } catch (err) {
      console.error('Failed to load vendors:', err);
      setError('Failed to load vendors');
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'text/html'];
      const allowedExtensions = ['.pdf', '.html', '.htm'];
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      
      if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
        setError('Please select a PDF or HTML file');
        return;
      }

      if (file.size > 10 * 1024 * 1024) { // 10MB
        setError('File size must be less than 10MB');
        return;
      }

      setSelectedFile(file);
      setError(null);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedVendor) {
      setError('Please select both a vendor and a file');
      return;
    }

    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('invoice', selectedFile);
      formData.append('vendor_id', selectedVendor);

      const response = await axios.post('/api/invoices/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setResult(response.data);
      setSelectedFile(null);
      // Reset file input
      const fileInput = document.getElementById('file-input');
      if (fileInput) fileInput.value = '';
      
    } catch (err) {
      console.error('Upload failed:', err);
      let message = 'Upload failed';
      
      if (err.response?.status === 409) {
        message = err.response.data.error + ' (Duplicate invoice detected)';
      } else if (err.response?.status === 502) {
        message = 'AI processing failed. Please check the document format and try again.';
      } else if (err.response?.data?.error) {
        message = err.response.data.error;
      }
      
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  const getFileIcon = (filename) => {
    if (filename.toLowerCase().endsWith('.pdf')) {
      return <FileText size={20} color="#e53e3e" />;
    }
    return <FileText size={20} color="#3182ce" />;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Box>
      {/* Header */}
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Upload size={32} color="#1B4B8C" />
        <Typography variant="h4">
          Import Invoices
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {result && (
        <Alert 
          severity="success" 
          sx={{ mb: 3 }}
          icon={<CheckCircle size={20} />}
        >
          <Typography variant="h6">Invoice processed successfully!</Typography>
          <Typography variant="body2">
            Invoice #{result.invoice.invoice_number} from {result.invoice.customer_name}
            <br />
            Amount: ${result.invoice.total_amount} | Confidence: {Math.round(result.invoice.confidence_score * 100)}%
            <br />
            Processing time: {result.invoice.processing_time_ms}ms | Line items: {result.invoice.line_items_count}
          </Typography>
        </Alert>
      )}

      {/* Upload Form */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Step 1: Select Vendor and File
        </Typography>
        
        <Box display="flex" flexDirection="column" gap={3}>
          {/* Vendor Selection */}
          <FormControl fullWidth>
            <InputLabel>Select Vendor *</InputLabel>
            <Select
              value={selectedVendor}
              label="Select Vendor *"
              onChange={(e) => setSelectedVendor(e.target.value)}
              disabled={uploading}
            >
              {vendors.map((vendor) => (
                <MenuItem key={vendor.id} value={vendor.id}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" width="100%">
                    <span>{vendor.display_name}</span>
                    <Chip 
                      label={`${vendor.invoice_count} invoices`} 
                      size="small" 
                      color="primary" 
                      variant="outlined" 
                    />
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* File Upload */}
          <Box>
            <input
              id="file-input"
              type="file"
              accept=".pdf,.html,.htm"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              disabled={uploading}
            />
            <label htmlFor="file-input">
              <Button
                variant="outlined"
                component="span"
                startIcon={<FileText />}
                disabled={uploading}
                sx={{ 
                  borderStyle: 'dashed',
                  borderWidth: 2,
                  p: 2,
                  width: '100%',
                  height: '60px'
                }}
              >
                {selectedFile ? 'Change File' : 'Choose Invoice File (PDF or HTML)'}
              </Button>
            </label>

            {selectedFile && (
              <Card sx={{ mt: 2, background: 'rgba(46, 124, 228, 0.05)' }}>
                <CardContent sx={{ py: 2 }}>
                  <Box display="flex" alignItems="center" gap={2}>
                    {getFileIcon(selectedFile.name)}
                    <Box flex={1}>
                      <Typography variant="body1" fontWeight={500}>
                        {selectedFile.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {formatFileSize(selectedFile.size)}
                      </Typography>
                    </Box>
                    <Chip 
                      label={selectedFile.type === 'application/pdf' ? 'PDF' : 'HTML'} 
                      color="primary" 
                      size="small" 
                    />
                  </Box>
                </CardContent>
              </Card>
            )}
          </Box>

          {/* Upload Button */}
          <Button
            variant="contained"
            size="large"
            onClick={handleUpload}
            disabled={!selectedFile || !selectedVendor || uploading}
            startIcon={uploading ? <CircularProgress size={20} /> : <Activity />}
            sx={{ 
              background: 'linear-gradient(135deg, #1B4B8C, #2E7CE4)',
              py: 1.5
            }}
          >
            {uploading ? 'Processing with Claude AI...' : 'Process Invoice'}
          </Button>
        </Box>
      </Paper>

      {uploading && (
        <Paper sx={{ p: 3 }}>
          <Box display="flex" alignItems="center" gap={2} mb={2}>
            <Activity size={20} />
            <Typography variant="h6">Processing Invoice...</Typography>
          </Box>
          <LinearProgress sx={{ mb: 2 }} />
          <Typography variant="body2" color="text.secondary">
            Claude AI is extracting data from your invoice. This typically takes 5-10 seconds.
          </Typography>
        </Paper>
      )}

      {/* Instructions */}
      <Paper sx={{ p: 3, background: 'rgba(248, 249, 250, 0.5)' }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          How It Works
        </Typography>
        <Box component="ol" sx={{ pl: 2 }}>
          <Typography component="li" variant="body2" sx={{ mb: 1 }}>
            **Select a vendor** from the dropdown (Genesys, Five9, or RingCentral)
          </Typography>
          <Typography component="li" variant="body2" sx={{ mb: 1 }}>
            **Choose your invoice file** (PDF or HTML format, max 10MB)
          </Typography>
          <Typography component="li" variant="body2" sx={{ mb: 1 }}>
            **Claude AI processes** the document and extracts structured data
          </Typography>
          <Typography component="li" variant="body2">
            **Review the results** in the Review & Approve section
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default ImportPage;