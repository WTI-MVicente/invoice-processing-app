import React from 'react';
import { Typography, Paper, Box } from '@mui/material';

const CustomersPage = () => {
  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Customers
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography variant="body1" color="text.secondary">
          Customer management interface will be implemented here.
          This will include customer records, account numbers, and aliases.
        </Typography>
      </Paper>
    </Box>
  );
};

export default CustomersPage;