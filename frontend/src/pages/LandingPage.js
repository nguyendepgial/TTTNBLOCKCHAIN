import { Container, Row, Col, Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

function LandingPage() {
  const navigate = useNavigate();

  return (
    <Container className="mt-5">
      <Row>
        <Col md={12} className="text-center"> {/* Căn giữa nội dung */}
          <h2>Chào bạn đến với hệ thống bán vé ca nhạc</h2>
          <p>Vui lòng đăng nhập để xem các sự kiện ca nhạc mới nhất.</p>
          <Button variant="primary" onClick={() => navigate("/login")} className="me-2">Đăng nhập</Button>
          <Button variant="secondary" onClick={() => navigate("/register")}>Đăng ký</Button>
        </Col>
      </Row>
    </Container>
  );
}

export default LandingPage;