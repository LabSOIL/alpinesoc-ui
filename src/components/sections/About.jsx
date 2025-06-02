
export default function About({ sectionsRef }) {
    return (
        <>
        <section
            className="section about-section"
            data-section="about"
            ref={el => sectionsRef.current[3] = el}
        >
            <div className="about-card distinct-about-card">
            <h2>About This Platform</h2>
            <div className="about-body">
                <p style={{ textIndent: "2em", marginBottom: "1.5em" }}>
                This platform provides access to measurements and model outputs of soil organic carbon (SOC), pH, temperature, and moisture across Swiss alpine catchments.
                </p>

                <h4>Attribution</h4>
                <ul style={{ marginLeft: "2em", marginBottom: "1em" }}>
                <li>
                    <a href="https://www.epfl.ch/labs/soil/" target="_blank" rel="noopener noreferrer">
                    Soil Biogeochemistry Laboratory
                    </a>
                </li>
                <li>
                    <a href="https://www.epfl.ch" target="_blank" rel="noopener noreferrer">
                    EPFL – École polytechnique fédérale de Lausanne
                    </a>
                </li>
                <li>
                    <a href="https://www.snf.ch" target="_blank" rel="noopener noreferrer">
                    SNSF – Swiss National Science Foundation
                    </a>
                </li>
                <li>
                    Platform development:
                    <a href="https://github.com/evanjt" target="_blank" rel="noopener noreferrer">Evan Thomas</a>
                </li>
                </ul>
            </div>
            </div>
        </section>
        </>
    );
}
