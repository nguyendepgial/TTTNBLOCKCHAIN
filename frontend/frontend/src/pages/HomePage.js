import { Container, Row, Col, Card, Button } from "react-bootstrap";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

function HomePage() {
  const [events, setEvents] = useState([]);
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const navigate = useNavigate(); 

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetch("http://localhost:5000/api/events");
        const data = await response.json();
        setEvents(data);
      } catch (error) {
        console.error("Lỗi khi tải sự kiện:", error);
      }
    };
    fetchEvents();
  }, []);

  return (
    <Container>
      <Row className="mb-5">
        <Col md={12}>
          {user ? (
            <div className="welcome-section text-center text-md-start">
              <h2 className="fw-bold">Chào mừng bạn, {user.full_name}</h2>
              <p className="text-muted">Khám phá ngay các sự kiện ca nhạc bùng nổ nhất.</p>
              <hr />
            </div>
          ) : (
            <div className="text-center py-5">
              <h2>Chào bạn đến với hệ thống vé concert!</h2>
              <p>Vui lòng đăng nhập để xem các sự kiện vé ca nhạc.</p>
              <Button size="lg" variant="primary" onClick={() => navigate("/login")}>
                Đăng nhập ngay
              </Button>
            </div>
          )}
        </Col>
      </Row>

      <Row className="g-4">
        {events.length > 0 ? (
          events.map((event) => (
            <Col md={4} key={event.id}>
              <Card className="shadow-sm border-0 rounded-4 h-100 overflow-hidden">
                <Card.Body className="p-4">
                  <h4 className="fw-bold mb-3">{event.name}</h4>
                  <p className="text-secondary">{event.description}</p>
                  <Button variant="outline-primary" className="w-100 mt-2">
                    Xem chi tiết
                  </Button>
                </Card.Body>
              </Card>
            </Col>
          ))
        ) : (
          <Col md={12} className="text-center">
            <div className="p-5 border rounded-3 bg-light">
              <p className="m-0">Chưa có sự kiện nào được cập nhật. Hãy quay lại sau nhé!</p>
            </div>
          </Col>
        )}
      </Row>
    </Container>
  );
}

export default HomePage;