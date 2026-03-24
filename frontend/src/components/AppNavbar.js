import React from "react";
import { Navbar, Nav, Button } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";

function AppNavbar() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "null");

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login"); // Sau khi logout, chuyển về trang đăng nhập
  };

  return (
    <Navbar bg="dark" variant="dark" expand="lg" className="navbar fixed-top">
      <div className="w-100">
        <Navbar.Brand as={Link} to="/" className="navbar-brand">
          Concert Ticket
        </Navbar.Brand>
        <Nav className="navbar-nav">
          {user ? (
            <>
              <Nav.Link as={Link} to="/home" className="nav-link">Trang chủ</Nav.Link>
              <Nav.Link as={Link} to="/events" className="nav-link">Sự kiện</Nav.Link>
              <Button variant="outline-light" onClick={handleLogout}>Đăng xuất</Button>
            </>
          ) : (
            <>
              <Nav.Link as={Link} to="/login" className="nav-link">Đăng nhập</Nav.Link>
              <Nav.Link as={Link} to="/register" className="nav-link">Đăng ký</Nav.Link>
            </>
          )}
        </Nav>
      </div>
    </Navbar>
  );
}

export default AppNavbar;