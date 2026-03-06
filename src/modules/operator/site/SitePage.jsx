import React, { useState } from "react";
import { useSite } from "../../../app/providers/SiteProvider";
import { Container, Row, Col, Card, Button, ButtonGroup } from "@themesberg/react-bootstrap";
import LegionHeroHeader from "../../../components/legion/LegionHeroHeader";

import BuildingImage from "../../../assets/img/bi.jpg";
import floor1Img from "../../../assets/img/floor1.png";
import floor2Img from "../../../assets/img/floor2.png";
import floor3Img from "../../../assets/img/floor3.png";

export default function SitePage() {
  const { site } = useSite();
  const [level, setLevel] = useState(0);

  const levelImages = {
    0: BuildingImage,
    1: floor1Img,
    2: floor2Img,
    3: floor3Img,
  };

  return (
    <Container fluid className="px-0">
      {/* HERO */}
      <div className="px-3 px-md-4 pt-3">
        <LegionHeroHeader />
        <hr className="border-light border-opacity-25 my-3" />
      </div>

      {/* PAGE */}
      <div className="px-3 px-md-4 pb-4 mt-3">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <h5 className="text-white fw-bold mb-0">Site Layout</h5>

          <ButtonGroup>
              <Button
              size="sm"
              variant={level === 0 ? "success" : "dark"}
              className={level === 0 ? "" : "border border-light border-opacity-10 text-white-50"}
              onClick={() => setLevel(0)}
            >
              Building
            </Button>
            <Button
              size="sm"
              variant={level === 1 ? "success" : "dark"}
              className={level === 1 ? "" : "border border-light border-opacity-10 text-white-50"}
              onClick={() => setLevel(1)}
            >
              Level 1
            </Button>
            <Button
              size="sm"
              variant={level === 2 ? "success" : "dark"}
              className={level === 2 ? "" : "border border-light border-opacity-10 text-white-50"}
              onClick={() => setLevel(2)}
            >
              Level 2
            </Button>
            <Button
              size="sm"
              variant={level === 3 ? "success" : "dark"}
              className={level === 3 ? "" : "border border-light border-opacity-10 text-white-50"}
              onClick={() => setLevel(3)}
            >
              Level 3
            </Button>
          </ButtonGroup>
        </div>

        <Row className="g-3">
          <Col xs={12}>
            <Card className="bg-primary border border-light border-opacity-10 shadow-sm overflow-hidden">
              <Card.Body className="p-0">
                <div className="legion-map-wrapper">
                  <img
                    src={levelImages[level]}
                    alt={level === 0 ? "Building" : `Level ${level}`}
                    className="legion-map-image"
                  />

                  {/* optional overlay title badge */}
                  <div className="legion-map-badge">
                    {site} • {level === 0 ? "Overview" : `Level ${level}`}
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </div>
    </Container>
  );
}
