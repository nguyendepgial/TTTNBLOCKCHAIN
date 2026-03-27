// src/components/Button.js
import React from "react";
import { Button } from "react-bootstrap";

function CustomButton({ variant, onClick, children, ...props }) {
  return (
    <Button variant={variant} onClick={onClick} {...props}>
      {children}
    </Button>
  );
}

export default CustomButton;