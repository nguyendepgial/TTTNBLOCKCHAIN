import { Container, Row, Col, Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

function LandingPage() {
  const navigate = useNavigate();

  return (
    <Container>
      {/* Căn giữa nội dung theo chiều dọc màn hình */}
      <Row className="align-items-center" style={{ minHeight: "60vh" }}>
        <Col md={12} className="text-center">
          <h2 className="display-4 fw-bold mb-4">Hệ Thống Bán Vé Ca Nhạc</h2>
          <p className="lead mb-5 text-muted">
            Trải nghiệm những đêm nhạc sống động. Đăng nhập để săn vé ngay hôm nay!
          </p>
          <div className="d-flex justify-content-center gap-3">
            <Button size="lg" variant="primary" onClick={() => navigate("/login")} className="px-5">
              Đăng nhập
            </Button>
            <Button size="lg" variant="outline-dark" onClick={() => navigate("/register")} className="px-5">
              Đăng ký
            </Button>
          </div>
        </Col>
      </Row>
    </Container>
  );
}

export default LandingPage;