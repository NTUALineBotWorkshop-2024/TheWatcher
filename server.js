const express = require("express")
const line = require("@line/bot-sdk")

// Load .env to environment variable
require("dotenv").config()

const { createServer } = require("node:http")
const { join } = require("node:path")
const { Server } = require("socket.io")

const app = express();

// Socket.io 串接要的前置作業
const server = createServer(app)
const io = new Server(server)

const port = process.env.PORT || 3001;

// Read the channel access token and secret from environment variable
const config = {
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.CHANNEL_SECRET
}

const client = new line.messagingApi.MessagingApiClient({
    channelAccessToken: config.channelAccessToken
})

const lineAccounts = []
const connect = []
let idname={}

app.get('/', (req, res) => {
    // res.send(`Hi ${req.query.name}!`)
    res.send(`<h1>Aloha 湯姆!</h1>`)
})
let date=[];
app.post('/webhook', line.middleware(config), (req, res) => {
    // req.body.events 可能有很多個
    for (const event of req.body.events) {
        handleEvent(event)
    }

    // 回傳一個 OK 給呼叫的 server，這邊應該是回什麼都可以
    res.send("OK")
})

function handleEvent(event) {
    // Debug 用，把 event 印出來
    console.log(event)

    // 如果不是文字訊息，就跳出
    if (event.type !== 'message' || event.message.type !== 'text') {
        //return
    }
    


    const userId = event.source.userId
    let index=lineAccounts.indexOf(userId);
    if ( index=== -1) {
        // userId 不在 lineAccounts 裡，把它加入
        lineAccounts.push(userId)
        connect.push(-1)

        client.getProfile(userId)
                .then((profile) => {
                    idname[userId]=profile.displayName
                    console.log(profile.displayName); //顯示使用者名字
                    //console.log(profile.userId);
                    //console.log(profile.pictureUrl); // 顯示使用者大頭照網址
                    //console.log(profile.statusMessage) // 使用者自介內容
                  })
                .catch((err) => {
                    // error handling
                  });

        console.log(`${userId} added to lineAccounts`)
        client.replyMessage({
            replyToken: event.replyToken,
            messages: [
                {
                    type: 'text',
                    text: `哈囉\n我只加熟人，陌生人請勿打擾!\n請輸入通關密語。`
                }
            ],
        })
    }
    else{
        if(connect[index]>0){

    // 把整包 event 送給 Unity (事件名稱為 to-unity，可自己取)
                io.emit("to-unity", JSON.stringify({
                    id: event.source.userId,
                    text: event.message.text
                }))
            
        }
        else{
            if(date.indexOf( event.message.text)===-1){
                if(connect[index]==0){
                    connect[index]=-1
                    client.replyMessage({
                        replyToken: event.replyToken,
                        messages: [
                            {
                                type: 'text',
                                text: `哈囉\n我只加熟人，陌生人請勿打擾!\n請輸入通關密語。`
                            }
                        ],
                    })
                }
                else if(connect[index]==-1)
                    {
                        connect[index]=-2
                        client.replyMessage({
                            replyToken: event.replyToken,
                            messages: [
                                {
                                    type: 'text',
                                    text: `提示:四個數字`
                                }
                            ],
                        })
                    }
                    else if(connect[index]==-2)
                    {
                        connect[index]=-3
                        client.replyMessage({
                            replyToken: event.replyToken,
                            messages: [
                                {
                                    type: 'text',
                                    text: `提示:生日`
                                }
                            ],
                        })
                    }
                    else{
                        client.replyMessage({
                            replyToken: event.replyToken,
                            messages: [
                                {
                                    type: 'text',
                                    text: `錯誤`
                                }
                            ],
                        })
                    }
            }
            else{
                
                console.log(idname[userId]+'連接成功')
                io.emit("to-unity", JSON.stringify({
                    id: event.source.userId,
                    name: idname[userId],
                    text: event.message.text
                }))
            }
        }
         
    }
    
    
    
    

    

    // 回覆一模一樣的訊息，多一個驚嘆號
    /*
    client.replyMessage({
        replyToken: event.replyToken,
        messages: [
            {
                type: 'text',
                text: `你剛剛傳的訊息是: ${event.message.text}`
            }
        ],
    })
    */
}

// 一個方便 DEBUG 的接收事件的網頁
app.get("/receive/:channel?", (req, res) => {
    res.type('html').sendFile(join(__dirname, "receive.html"))
})

// 一個方便 DEBUG 的傳送事件的網頁
app.get("/send/:channel?", (req, res) => {
    console.log(`channel: ${req.params.channel}`)
    console.log(`message: ${req.query.message}`)
    io.emit(req.params.channel, req.query.message)
    res.send("")
})
// 當有 client 連進 socket.io 時 (Unity 或 DEBUG 網頁)
io.on("connection", (socket) => {
    console.log("a user connected")
    for (let i=0;i<lineAccounts.length;i++) {
        if(connect[i]==0){
            //connect[i]=-1;
            /*
            client.pushMessage({
                to: lineAccounts[i],
                messages: [
                    {
                        type: 'text',
                        text: `安安\n我只加熟人，陌生人請勿打擾!\n請輸入通關密語。`
                    }
                ],
            })
            */
        }
        
    }

    // 當有任何 socket.io 事件時
    socket.onAny((event, data) => {
        console.log(`on any: ${event}, ${data}`)

        // 把這個事件傳給所有有連到 socket.io 的 client
        socket.broadcast.emit(event, data)

        // 如果事件名字是 to-line，則推播事件內容 data 到所有 lineAccounts 裡的帳號
        if (event === "to-line") {
            
            
            client.pushMessage({
                to: data.id,
                messages: [
                    {
                        type: 'text',
                        text: data.text
                    }
                ],
            })
            
        }
        if (event === "setdate"){
            date.push( data.date)
        }
        if (event === "setconnect"){
                connect[lineAccounts.indexOf(data.id)]=1;
                date.splice( date.indexOf(data.date),1 );
            
            
        }
        if (event === "disconnected") {

            console.log(data.id)
            if(lineAccounts.indexOf(data.id)>=0){
                connect[lineAccounts.indexOf(data.id)]=0;
                date.splice( date.indexOf(data.date),1 )
                console.log(date)
            }
            

        }
    })

    socket.on("disconnect", () => {
        console.log("user disconnected")
    })
})

server.listen(port, () => {
    console.log(`server running at http://localhost:${port}!`)
})
