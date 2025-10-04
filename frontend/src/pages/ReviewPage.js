import React from 'react';
import { Typography, Paper, Box } from '@mui/material';

const ReviewPage = () => {
  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Review & Approve
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography variant="body1" color="text.secondary">
          Review and approval interface will be implemented here.
          This will include the split-screen PDF viewer and editable data tables.
        </Typography>
      </Paper>
    </Box>
  );
};

export default ReviewPage;