import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import HomePage from "./pages/HomePage"; 
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AppNavbar from "./components/AppNavbar"; 
import LandingPage from "./pages/LandingPage"; 

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser)); // Nếu có user thì gán vào state
    }
  }, []);

  return (
    <BrowserRouter>
      <div style={{ fontFamily: "Inter" }}>
        <AppNavbar /> {/* Navbar hiển thị ở đây */}
        
        <Routes>
          {/* Nếu người dùng chưa đăng nhập, hiển thị LandingPage */}
          <Route path="/" element={user ? <HomePage /> : <LandingPage />} />

          {/* Các route khác */}
          <Route path="/home" element={user ? <HomePage /> : <LoginPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="*" element={<LoginPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;