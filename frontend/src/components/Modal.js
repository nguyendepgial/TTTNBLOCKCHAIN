// src/components/Modal.js
import React from "react";
import { Modal, Button } from "react-bootstrap";

function CustomModal({ show, handleClose, title, bodyText, footerAction }) {
  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>{bodyText}</Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Đóng
        </Button>
        {footerAction}
      </Modal.Footer>
    </Modal>
  );
}

export default CustomModal;