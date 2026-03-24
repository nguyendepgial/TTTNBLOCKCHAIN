// src/components/AppNavbar.js
import React from "react";
import { Navbar, Nav, Button, Container } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";

function AppNavbar() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "null");

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <Navbar bg="dark" variant="dark" expand="lg" className="mb-4">
      <Container>
        <Navbar.Brand as={Link} to="/">
          Concert Ticket
        </Navbar.Brand>
        <Nav className="ms-auto">
          {!user ? (
            <>
              <Nav.Link as={Link} to="/login">Đăng nhập</Nav.Link>
              <Nav.Link as={Link} to="/register">Đăng ký</Nav.Link>
            </>
          ) : (
            <>
              <Nav.Link as={Link} to="/home">Trang chủ</Nav.Link>
              <Button variant="outline-light" onClick={handleLogout}>Đăng xuất</Button>
            </>
          )}
        </Nav>
      </Container>
    </Navbar>
  );
}

export default AppNavbar;