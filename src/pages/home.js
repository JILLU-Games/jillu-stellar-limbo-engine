import * as React from "react";
import Content from "../components/content";
import { Box, Container } from "@mui/material";

export default function Home() {
  return (
    <Box className="casino-app-container">
      <Container maxWidth="lg" sx={{ px: { xs: 0.4, sm: 1.5, md: 2 }, py: { xs: 0.5, sm: 1.5 } }}>
        {/* Main Casino Limbo Game Module */}
        <Box sx={{ maxWidth: "860px", margin: "0 auto" }}>
          <Content />
        </Box>
      </Container>
    </Box>
  );
}
