import React from 'react';
import { Outlet } from 'react-router-dom';
import { Box, AppBar, Toolbar, Typography, Container } from '@mui/material';
import { BarChart3 } from 'lucide-react';
import Sidebar from './Sidebar';
import { brandColors } from '../../theme/theme';

const Layout = () => {
  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      {/* Header */}
      <AppBar 
        position="fixed" 
        sx={{ 
          zIndex: (theme) => theme.zIndex.drawer + 1,
          background: brandColors.techGradient,
          boxShadow: '0 4px 20px rgba(27, 75, 140, 0.3)'
        }}
      >
        <Toolbar>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <BarChart3 size={24} color="white" />
            <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 500, color: 'white' }}>
              Waterfield Technologies - Invoice Processing
            </Typography>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          marginTop: '64px',
          height: 'calc(100vh - 64px)',
          overflow: 'auto',
        }}
      >
        <Container maxWidth={false} sx={{ py: 3, px: 3 }}>
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
};

export default Layout;