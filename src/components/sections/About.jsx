import React from "react";
import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import LanguageIcon from "@mui/icons-material/Language";
import GitHubIcon from "@mui/icons-material/GitHub";


export default function About({ sectionsRef }) {
return (
    <section
        className="section about-section"
        data-section="about"
        ref={(el) => (sectionsRef.current[3] = el)}
    >
        <div className="about-card distinct-about-card">
            <div className="about-body">
                <Typography
                    variant="body1"
                    paragraph
                    sx={{ fontSize: "1rem", mb: 1.5, lineHeight: 1.6, textAlign: "justify" }}
                >
                    This platform provides access to measurements, regional data maps
                    and model outputs across two Swiss alpine catchments. 
                    The catchments are situated in the Southern part of the Swiss Alpine Arc 
                    in the canton of Wallis, specifically in Vallon de 
                    Réchy (Ar du Tsan) and in Binntal (Blatt).
                </Typography>
                <Typography
                    variant="h6"
                    component="h3"
                    sx={{ mt: 2, mb: 0.75, fontWeight: 600 }}
                >
                    Experimental data
                </Typography>
                <Typography
                    variant="body1"
                    paragraph
                    sx={{ fontSize: "1rem", mb: 1.5, lineHeight: 1.6, textAlign: "justify" }}
                >
                    SOC concentration in fine soil (% dry weight) and pH were determined at 
                    50 locations per catchment at soil depths of 0-10, 10-30, and 30-50 cm. 
                    SOC stocks were calculated from SOC and fine soil (&lt;2mm) abundances and 
                    integrated over the total soil depth (up to 50 cm). pH was measured 
                    in water-extracted soil samples. Only the value of the topsoil (0-10 cm) is displayed.
                </Typography>
                <Typography
                    variant="body1"
                    paragraph
                    sx={{ fontSize: "1rem", mb: 1.5, lineHeight: 1.6, textAlign: "justify" }}
                >
                    Soil temperature and moisture were monitored at two depths (10 and 30 cm) where 
                    possible (soil depth &gt; 30 cm and not waterlogged) using{" "}
                    <Link
                        href="https://tomst.com/web/en/systems/tms/tms-4/"
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ fontSize: "1rem", color: "#90caf9" }}
                    >
                        TMS-4 TOMST loggers
                    </Link>.
                    In addition, air temperature at the soil surface was monitored alongside 
                    measurements at 30 cm. Soil moisture is presented in [raw counts] 
                    ranging from 115 in dry air to 3635 in distilled water.
                </Typography>

                <Typography
                    variant="h6"
                    component="h3"
                    sx={{ mt: 2, mb: 0.75, fontWeight: 600 }}
                >
                    Modelling data
                </Typography>
                <Typography
                    variant="body1"
                    paragraph
                    sx={{ fontSize: "1rem", mb: 1.5, lineHeight: 1.6, textAlign: "justify" }}
                >
                    We interpolated SOC stocks between measurement locations using 
                    a random forest approach (both sites) and regression Kriging (Vallon de Réchy site). 
                    As input, we used maps of soil type (newly generated based on 
                    soil pit observations), plant biomass (inferred from NDVI averaged over 
                    4 years and calculated from satellite imagery from Google Earth Engine), 
                    curvature (derived from SwissAlti3D), vegetation (adapted from publications 
                    in the Bulletin de la Murithienne 111/1993 and 113/1995), and 
                    published maps for lithology (Swiss Topo Lithology GeoCover) 
                    and digital elevation model (Swiss Topo SwissAlti3D).
                </Typography>
                <Typography
                    variant="h6"
                    component="h3"
                    sx={{ mt: 2, mb: 0.75, fontWeight: 600 }}
                >
                    Attribution
                </Typography>

                <List dense sx={{ pl: 1, mb: 1 }}>
                    <ListItem disableGutters sx={{ py: 0.3 }}>
                        <Link
                            href="https://www.epfl.ch/labs/soil/"
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ fontSize: "1rem" }}
                        >
                            Soil Biogeochemistry Laboratory
                        </Link>
                    </ListItem>
                    <ListItem disableGutters sx={{ py: 0.3 }}>
                        <Link
                            href="https://www.epfl.ch"
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ fontSize: "1rem" }}
                        >
                            EPFL – École polytechnique fédérale de Lausanne
                        </Link>
                    </ListItem>
                    <ListItem disableGutters sx={{ py: 0.3 }}>
                        <Link
                            href="https://www.snf.ch"
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ fontSize: "1rem" }}
                        >
                            SNSF – Swiss National Science Foundation
                        </Link>
                    </ListItem>
                    <br/>
                    <ListItem
                        disableGutters
                        sx={{ py: 0.3, display: "flex", alignItems: "center" }}
                    >
                        <Typography
                            variant="body3"
                            sx={{ fontSize: "1rem", mr: 0.5 }}
                        >
                            Development: Evan Thomas
                        </Typography>
                        <Link
                            href="https://github.com/evanjt"
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ ml: 0.5 }}
                        >
                            <GitHubIcon sx={{ fontSize: "1rem", color: "#90caf9" }} />
                        </Link>
                        <Link
                            href="https://www.linkedin.com/in/evanjt"
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ ml: 0.5 }}
                        >
                            <LinkedInIcon sx={{ fontSize: "1rem", color: "#90caf9" }} />
                        </Link>
                        <Link
                            href="https://evanjt.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ ml: 0.5 }}
                        >
                            <LanguageIcon sx={{ fontSize: "1rem", color: "#90caf9" }} />
                        </Link>
                    </ListItem>
                    <ListItem disableGutters sx={{ py: 0.3, display: "flex", alignItems: "center" }}>
                        
                    <Typography
                            variant="body3"
                            sx={{ fontSize: "1rem", mr: 0.5 }}
                        >
                            Code: 
                        </Typography>
                        <Link
                            href="https://github.com/LabSOIL/alpinesoc-ui"
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ display: "flex", alignItems: "center", fontSize: "1rem", color: "#90caf9" }}
                        >
                            <GitHubIcon sx={{ fontSize: "1rem", mr: 0.5 }} />
                            alpinesoc-ui
                        </Link>
                    </ListItem>
                </List>
            </div>
        </div>
    </section>
);
}
