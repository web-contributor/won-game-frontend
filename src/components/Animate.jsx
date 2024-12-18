import { motion } from "framer-motion";

const animations = {
    initial: { opacity: 0 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0 },
};

const Animate = ({ children, minify }) => {
    return (
        <motion.div
            variants={animations}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.5, delay: 0.3 }}
            className={`w-full ${minify ? 'h-[100%]' : 'h-[100%]'}`}>
            {children}
        </motion.div>
    );
};

export default Animate;