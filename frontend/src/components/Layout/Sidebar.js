import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Toolbar,
} from '@mui/material';
import {
  Upload,
  CheckCircle,
  Building2,
  Users,
  Code,
  Download,
  Database,
} from 'lucide-react';
import { brandColors } from '../../theme/theme';

const menuItems = [
  { key: 'import', label: 'Import Invoices', icon: Upload, path: '/import' },
  { key: 'review', label: 'Review & Approve', icon: CheckCircle, path: '/review' },
  { key: 'invoices', label: 'Invoices', icon: Database, path: '/invoices' },
  { key: 'vendors', label: 'Vendors', icon: Building2, path: '/vendors' },
  { key: 'prompts', label: 'Prompts', icon: Code, path: '/prompts' },
  { key: 'export', label: 'Export', icon: Download, path: '/export' },
];

const drawerWidth = 240;

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        [`& .MuiDrawer-paper`]: {
          width: drawerWidth,
          boxSizing: 'border-box',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(27, 75, 140, 0.1)',
        },
      }}
    >
      <Toolbar />
      <Box sx={{ overflow: 'auto' }}>
        <List>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || 
              (item.path === '/import' && location.pathname === '/');
            
            return (
              <ListItem key={item.key} disablePadding>
                <ListItemButton
                  onClick={() => navigate(item.path)}
                  sx={{
                    mx: 1,
                    my: 0.5,
                    borderRadius: '8px',
                    borderLeft: isActive ? '3px solid #2E7CE4' : '3px solid transparent',
                    backgroundColor: isActive ? 'rgba(46, 124, 228, 0.1)' : 'transparent',
                    color: isActive ? brandColors.primaryBlue : brandColors.darkGray,
                    fontWeight: isActive ? 600 : 400,
                    '&:hover': {
                      backgroundColor: 'rgba(46, 124, 228, 0.05)',
                    },
                    transition: 'all 0.3s ease',
                  }}
                >
                  <ListItemIcon
                    sx={{
                      color: 'inherit',
                      minWidth: 36,
                    }}
                  >
                    <Icon size={20} />
                  </ListItemIcon>
                  <ListItemText 
                    primary={item.label}
                    primaryTypographyProps={{
                      fontSize: '0.875rem',
                      fontWeight: 'inherit',
                    }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>
    </Drawer>
  );
};

export default Sidebar;