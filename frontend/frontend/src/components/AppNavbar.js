import React from "react";
import { Dropdown } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import "../styles/navbar.css"; // Đảm bảo bạn đã import file css

function AppNavbar() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "null");

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        
        {/* 1. Bên trái: Logo */}
        <div className="logo-section">
          <Link to="/" className="navbar-logo">
            Concert Ticket
          </Link>
        </div>

        {/* 2. Ở giữa: Menu điều hướng */}
        <div className="menu-section">
          <div className="navbar-nav-custom">
            <Link to="/home" className="nav-link-custom">Trang chủ</Link>
            <Link to="/home" className="nav-link-custom">Sự kiện</Link>
          </div>
        </div>

        {/* 3. Bên phải: Auth section */}
        <div className="auth-section">
          {user ? (
            <Dropdown align="end">
              <Dropdown.Toggle variant="outline-light" id="dropdown-user">
                <i className="fa fa-user"></i>
              </Dropdown.Toggle>
              <Dropdown.Menu>
                <Dropdown.Item as={Link} to="/profile">Hồ sơ</Dropdown.Item>
                <Dropdown.Divider />
                <Dropdown.Item onClick={handleLogout}>Đăng xuất</Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          ) : (
            <>
              <Link to="/login" className="auth-link">Đăng nhập</Link>
              <Link to="/register" className="auth-link">Đăng ký</Link>
            </>
          )}
        </div>

      </div>
    </nav>
  );
}

export default AppNavbar;