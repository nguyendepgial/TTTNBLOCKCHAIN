import { Container, Row, Col, Card, Button } from "react-bootstrap";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

function HomePage() {
  const [events, setEvents] = useState([]); // Dữ liệu sự kiện
  const user = JSON.parse(localStorage.getItem("user") || "null"); // Kiểm tra người dùng
  const navigate = useNavigate(); 

  // Lấy dữ liệu sự kiện từ API hoặc từ nguồn dữ liệu
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetch("http://localhost:5000/api/events"); // URL lấy sự kiện
        const data = await response.json();
        setEvents(data);  // Giả sử API trả về danh sách sự kiện
      } catch (error) {
        console.error("Lỗi khi tải sự kiện:", error);
      }
    };
    fetchEvents();
  }, []);

  return (
    <Container className="mt-5">
      <Row>
        <Col md={12}>
          {user ? (
            <>
              <h2>Chào mừng bạn, {user.full_name}</h2>
              <p>Danh sách các sự kiện ca nhạc hiện có.</p>
            </>
          ) : (
            <>
              <h2>Chào bạn đến với hệ thống vé concert!</h2>
              <p>Vui lòng đăng nhập để xem các sự kiện vé ca nhạc.</p>
              <Button variant="primary" onClick={() => navigate("/login")}>Đăng nhập</Button>
            </>
          )}
        </Col>
      </Row>

      {/* Hiển thị danh sách sự kiện */}
      <Row className="g-4">
        {events.length > 0 ? (
          events.map((event) => (
            <Col md={4} key={event.id}>
              <Card className="shadow-sm border-0 rounded-4 h-100">
                <Card.Body className="p-4">
                  <h4 className="fw-bold mb-3">{event.name}</h4>
                  <p>{event.description}</p>
                  <Button variant="primary" className="mt-3">
                    Xem chi tiết
                  </Button>
                </Card.Body>
              </Card>
            </Col>
          ))
        ) : (
          <Col md={12}>
            <p>Chưa có sự kiện nào. Hãy thử lại sau.</p>
          </Col>
        )}
      </Row>
    </Container>
  );
}

export default HomePage;