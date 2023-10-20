require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const app = express();
const secretKey = process.env.secretKey
app.use(express.urlencoded({ extended: false }))
app.use(express.json());
const connect = async () => {
    try {
        await mongoose.connect(process.env.DATABASE);
        console.log("connected to mondodb");
    } catch (error) {
        throw error;
    }
};
mongoose.connection.on('disconnected', () => {
    console.log("mongodb disconnected");
});


const user_seller_Schema = new mongoose.Schema({
    username: { type: String, required: true },
    password: { type: String, required: true },
    userType: { type: String, required: true },

});
const User = mongoose.model('User', user_seller_Schema);

const productSchema = new mongoose.Schema({
    name: { type: String },
    price: { type: Number },
});

const Product = mongoose.model('Product', productSchema);


const orderSchema = new mongoose.Schema({
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    items: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
});

const Order = mongoose.model('Order', orderSchema);

const catalogSchema = new mongoose.Schema({
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
});

const Catalog = mongoose.model('Catalog', catalogSchema);



app.post('/api/auth/register', async (req, res) => {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(req.body.password, salt);
    try {
        const user = await User.findOne({ username: req.body.username })
        // console.log(user);
        if (!user) {
            // console.log(user);
            const newperson = new User(
                { ...req.body, password: hash }
            );
            try {

                const saveduser = await newperson.save();
                const token = jwt.sign(
                    { userId: saveduser._id, userType: saveduser.userType },
                    secretKey
                );

                res.status(200).json({ token });

            } catch (err) {
                console.log(err);
            }
        }
        else {

            res.status(200).json(0)
        }
    }
    catch (err) {
        console.log(err);
    }

});




app.post('/api/auth/login', async (req, res) => {
    try {

        const user = await User.findOne({ username: req.body.username })
        console.log(user);
        if (user === null) {
            res.status(200).json(0)
        } else {
            let isPasswordCorrect
            isPasswordCorrect = await bcrypt.compare(req.body.password, user.password);
            if (isPasswordCorrect) {
                const token = jwt.sign(
                    { userId: user._id, userType: user.userType },
                    secretKey
                );

                res.status(200).json({ token });
            }
            else
                res.status(200).json(-1)
        }
    } catch (err) {
        console.log(err);
        res.status(200).json("error came")

    }

});



function verifyToken(req, res, next) {
    const token = req.header('Authorization');

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, secretKey);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid token' });
    }
}


app.get('/api/buyer/list-of-sellers', verifyToken, async (req, res) => {
    try {
        console.log(req.user);
        if (req.user.userType == "buyer") {
            const sellers = await User.find({ userType: 'seller' });
            const sellerList = sellers.map((seller) => {
                return { id: seller._id, username: seller.username };
            });
            res.json(sellerList);
        }
        else {
            res.status(500).json({ message: 'Not authenticated' });
        }

    } catch (err) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});





app.get('/api/buyer/seller-catalog/:seller_id', verifyToken, async (req, res) => {
    const sellerId = req.params.seller_id;
    console.log(sellerId);
    try {
        if (req.user.userType == "buyer") {
            const catalog = await Catalog.findOne({ sellerId: sellerId });

            if (!catalog) {
                return res.status(404).json({ message: 'Catalog not found' });
            }

            res.json(catalog);
        }
        else {
            res.status(500).json({ message: 'Not authenticated' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


app.post('/api/buyer/create-order/:seller_id', verifyToken, async (req, res) => {
    const sellerId = req.params.seller_id;
    const items = req.body.items;

    try {
        // Create a new order
        if (req.user.userType == "buyer") {
            const order = new Order({
                buyerId: req.user.userId,
                sellerId: sellerId,
                items: items,
            });

            await order.save();

            res.status(201).json({ message: 'Order created successfully' });
        }
        else {
            res.status(500).json({ message: 'Not authenticated' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});






// for seller

app.post('/api/seller/create-catalog', verifyToken, async (req, res) => {
    const items = req.body.items;

    try {
        // Create a new catalog
        if (req.user.userType == "seller") {
            const catalog = new Catalog({
                sellerId: req.user.userId,
                products: items,
            });

            await catalog.save();

            res.status(201).json({ message: 'Catalog created successfully' });
        }
        else {
            res.status(500).json({ message: 'Not authenticated' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});



app.get('/api/seller/orders', verifyToken, async (req, res) => {

    try {
        if (req.user.userType == "seller") {
            const orders = await Order.find({ sellerId: req.user.userId });
            res.json(orders);
        }
        else {
            res.status(500).json({ message: 'Not authenticated' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    connect();
    console.log(`Listening on port ${PORT}`)
})
